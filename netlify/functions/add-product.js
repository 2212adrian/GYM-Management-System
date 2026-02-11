const { createClient } = require('@supabase/supabase-js');
const crypto = require('node:crypto');

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function parseJsonBody(body) {
  if (!body) return {};
  if (typeof body === 'string') {
    if (!body.trim()) return {};
    return JSON.parse(body);
  }
  return body;
}

function toOptionalText(value, maxLen = 1024) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  if (!text) return null;
  return text.slice(0, maxLen);
}

function hashWithSecret(parts, secret) {
  return crypto.createHash('sha256').update(parts.join('|')).digest('hex');
}

function isMissingIntegrityColumnError(error) {
  return (
    error &&
    (error.code === 'PGRST204' ||
      (typeof error.message === 'string' &&
        (/column .* does not exist/i.test(error.message) ||
          /could not find the .* column/i.test(error.message))))
  );
}

async function insertProductWithIntegrityHash(supabase, payload, hashSecret) {
  const productIntegrityHash = hashWithSecret(
    [
      payload.sku || '',
      payload.name || '',
      payload.description || '',
      payload.brand || '',
      String(payload.price ?? ''),
      String(payload.qty ?? ''),
      payload.image_url || '',
    ],
    hashSecret,
  );

  const insertWithIntegrityHash = {
    ...payload,
    integrity_hash: productIntegrityHash,
  };

  let { data, error } = await supabase
    .from('products')
    .insert(insertWithIntegrityHash)
    .select()
    .single();

  const columnMissing =
    isMissingIntegrityColumnError(error);

  if (columnMissing) {
    ({ data, error } = await supabase
      .from('products')
      .insert(payload)
      .select()
      .single());
  }

  if (error) throw error;

  return { row: data, integrityHash: productIntegrityHash };
}

async function updateProductWithIntegrityHash(
  supabase,
  productId,
  payload,
  hashSecret,
) {
  const productIntegrityHash = hashWithSecret(
    [
      payload.sku || '',
      payload.name || '',
      payload.description || '',
      payload.brand || '',
      String(payload.price ?? ''),
      String(payload.qty ?? ''),
      payload.image_url || '',
    ],
    hashSecret,
  );

  const updateWithIntegrityHash = {
    ...payload,
    integrity_hash: productIntegrityHash,
  };

  let { data, error } = await supabase
    .from('products')
    .update(updateWithIntegrityHash)
    .eq('productid', productId)
    .select()
    .single();

  if (isMissingIntegrityColumnError(error)) {
    ({ data, error } = await supabase
      .from('products')
      .update(payload)
      .eq('productid', productId)
      .select()
      .single());
  }

  if (error) throw error;

  return { row: data, integrityHash: productIntegrityHash };
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  if (!supabaseUrl || !serviceRoleKey) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Missing Supabase server env vars' }),
    };
  }

  const hashSecret = process.env.PRODUCT_HASH_SECRET || serviceRoleKey;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    let payload;
    try {
      payload = parseJsonBody(event.body);
    } catch (_) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid request body JSON' }),
      };
    }

    const productId = toOptionalText(payload.productId, 80);
    const createSale =
      payload.createSale === true || String(payload.createSale) === 'true';
    const sku = toOptionalText(payload.sku, 120);
    const name = toOptionalText(payload.name, 200);
    const description = toOptionalText(payload.description, 5000);
    const brand = toOptionalText(payload.brand, 200);
    const imageUrl = toOptionalText(payload.imageUrl, 600000);
    const price = Number(payload.price);
    const qty = Number(payload.qty);

    if (!Number.isFinite(price) || price < 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid price value' }),
      };
    }

    if (!Number.isInteger(qty) || qty < 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid quantity value' }),
      };
    }

    if (!productId && (!sku || !name)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required product fields' }),
      };
    }

    let finalProductId = productId;
    let productRow = null;
    let productIntegrityHash = null;
    let didCreateProduct = false;
    let didUpdateProduct = false;

    if (!finalProductId) {
      const baseProductPayload = {
        sku,
        name,
        description,
        brand,
        price,
        qty,
        image_url: imageUrl,
        is_active: true,
      };

      const inserted = await insertProductWithIntegrityHash(
        supabase,
        baseProductPayload,
        hashSecret,
      );
      productRow = inserted.row;
      finalProductId = inserted.row.productid;
      productIntegrityHash = inserted.integrityHash;
      didCreateProduct = true;
    } else {
      const { data: existing, error: existingErr } = await supabase
        .from('products')
        .select('*')
        .eq('productid', finalProductId)
        .maybeSingle();

      if (existingErr) throw existingErr;
      if (!existing) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Product not found' }),
        };
      }

      if (createSale) {
        productRow = existing;
        productIntegrityHash = hashWithSecret(
          [
            existing.sku || '',
            existing.name || '',
            existing.description || '',
            existing.brand || '',
            String(existing.price ?? ''),
            String(existing.qty ?? ''),
            existing.image_url || '',
          ],
          hashSecret,
        );
      } else {
        const updatePayload = {
          sku,
          name,
          description,
          brand,
          price,
          qty,
          image_url: imageUrl,
          is_active: true,
        };
        const updated = await updateProductWithIntegrityHash(
          supabase,
          finalProductId,
          updatePayload,
          hashSecret,
        );
        productRow = updated.row;
        productIntegrityHash = updated.integrityHash;
        didUpdateProduct = true;
      }
    }

    let sale = null;
    let saleIntegrityHash = null;

    if (createSale) {
      const { data: saleRow, error: saleErr } = await supabase
        .from('sales')
        .insert({
          product_id: finalProductId,
          qty,
          unit_price: price,
        })
        .select()
        .single();

      if (saleErr) throw saleErr;
      sale = saleRow;

      // Keep a hashed audit trail without exposing raw details.
      saleIntegrityHash = hashWithSecret(
        [
          sale.id || '',
          finalProductId,
          String(qty),
          String(price),
          String(sale.created_at || ''),
        ],
        hashSecret,
      );
    }

    const changePayload = {
      product_integrity_hash: productIntegrityHash,
    };
    if (saleIntegrityHash) {
      changePayload.sale_integrity_hash = saleIntegrityHash;
    }

    const { error: auditErr } = await supabase.from('audit_log').insert({
      table_name: 'products',
      operation: createSale
        ? 'SECURE_ADD_TO_SALES'
        : didUpdateProduct
          ? 'SECURE_UPDATE_PRODUCT'
          : 'SECURE_ADD_PRODUCT',
      record_id: String(finalProductId),
      change_payload: changePayload,
    });

    if (auditErr) {
      console.warn('Audit insert warning:', auditErr.message);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: createSale
          ? 'Product and sale write secured'
          : didUpdateProduct
            ? 'Product update secured'
            : didCreateProduct
              ? 'Product write secured'
              : 'Product request secured',
        product: productRow,
        sale,
      }),
    };
  } catch (error) {
    const message = error?.message || 'Unexpected server error';
    const duplicateKey =
      typeof message === 'string' &&
      /duplicate key value violates unique constraint/i.test(message);

    return {
      statusCode: duplicateKey ? 409 : 500,
      headers,
      body: JSON.stringify({ error: message }),
    };
  }
};
