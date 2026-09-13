-- Les alliés sont gratuits. Les anciens dossiers encore bloqués à l'étape de
-- paiement reprennent le parcours normal de vérification, sans appel Stripe.
UPDATE "ResourceProfile"
SET
  "onboardingState" = 'PENDING_VERIFICATION',
  "verificationStatus" = CASE
    WHEN "verificationStatus" = 'DRAFT' THEN 'PENDING_VERIFICATION'::"ResourceVerificationStatus"
    ELSE "verificationStatus"
  END,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "onboardingState" = 'PENDING_PAYMENT';
