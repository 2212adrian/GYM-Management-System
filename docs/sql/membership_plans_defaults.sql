-- Default flexible subscription plans used by logbook membership pricing.
-- Monthly: PHP 1000 upfront, free gym entry until subscription expiry.
-- Yearly: PHP 500 upfront, regular walk-in fee is discounted from PHP 80 to PHP 60.
-- Note: student discount does not stack with yearly subscription discount.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.membership_plans
    WHERE UPPER(BTRIM(name)) = 'MONTHLY SUBSCRIPTION'
  ) THEN
    INSERT INTO public.membership_plans (
      name,
      description,
      billing_period_interval,
      billing_period_unit,
      price,
      allow_pauses
    ) VALUES (
      'MONTHLY SUBSCRIPTION',
      'PHP 1000 upfront. Free gym entry until expiration.',
      1,
      'month',
      1000,
      false
    );
  ELSE
    UPDATE public.membership_plans
    SET
      description = 'PHP 1000 upfront. Free gym entry until expiration.',
      billing_period_interval = 1,
      billing_period_unit = 'month',
      price = 1000,
      allow_pauses = false,
      updated_at = now()
    WHERE UPPER(BTRIM(name)) = 'MONTHLY SUBSCRIPTION';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.membership_plans
    WHERE UPPER(BTRIM(name)) = 'YEARLY SUBSCRIPTION'
  ) THEN
    INSERT INTO public.membership_plans (
      name,
      description,
      billing_period_interval,
      billing_period_unit,
      price,
      allow_pauses
    ) VALUES (
      'YEARLY SUBSCRIPTION',
      'PHP 500 upfront. Regular walk-in fee discounted to PHP 60 while active.',
      1,
      'year',
      500,
      false
    );
  ELSE
    UPDATE public.membership_plans
    SET
      description = 'PHP 500 upfront. Regular walk-in fee discounted to PHP 60 while active.',
      billing_period_interval = 1,
      billing_period_unit = 'year',
      price = 500,
      allow_pauses = false,
      updated_at = now()
    WHERE UPPER(BTRIM(name)) = 'YEARLY SUBSCRIPTION';
  END IF;
END
$$;

