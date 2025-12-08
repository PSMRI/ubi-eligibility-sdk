const { checkCriteria } = require("../../utils/eligibilityUtils");
const RuleInterface = require("../interfaces/RuleInterface");
const { translate } = require("../../utils/i18n");

/**
 * Rule class for checking user document criteria
 * @class
 * @extends RuleInterface
 * @example
 * // Example 1: Aadhaar document check with strict checking
 * const userProfile = {
 *     "name": "John Doe",
 *     "documents": {
 *         "aadhaar": {
 *             "type": "aadhaar",
 *             "number": "123456789012",
 *             "verified": true,
 *             "expiryDate": "2025-12-31"
 *         }
 *     }
 * };
 * 
 * const criteria = {
 *     "documentType": "aadhaar",
 *     "name": "expiryDate",
 *     "condition": "gte",
 *     "conditionValues": "2024-01-01",
 *     "allowedProofs": ["aadhaar", "pan"],
 *     "description": "Aadhaar card must be valid and not expired",
 *     "strictChecking": true
 * };
 * 
 * const rule = new UserDocumentRule();
 * const result = await rule.execute(userProfile, criteria, true);
 * // Returns:
 * [] // Empty array means all criteria passed
 * 
 * // Example 2: Missing document with strict checking
 * const userProfile = {
 *     "name": "Jane Doe",
 *     "documents": {} // No documents
 * };
 * 
 * const result = await rule.execute(userProfile, criteria, true);
 * // Returns:
 * [{
 *     "type": "userDocument",
 *     "field": "aadhaar",
 *     "reason": "Missing required document: aadhaar",
 *     "description": "Aadhaar card must be valid and not expired"
 * }]
 * 
 * // Example 3: Invalid document type
 * const userProfile = {
 *     "name": "Mike Smith",
 *     "documents": {
 *         "aadhaar": {
 *             "type": "driving_license", // Not in allowed proofs
 *             "number": "DL123456",
 *             "verified": true
 *         }
 *     }
 * };
 * 
 * const result = await rule.execute(userProfile, criteria, true);
 * // Returns:
 * [{
 *     "type": "userDocument",
 *     "field": "aadhaar",
 *     "reason": "Document type 'driving_license' not allowed",
 *     "description": "Aadhaar card must be valid and not expired",
 *     "userValue": "driving_license",
 *     "requiredValue": ["aadhaar", "pan"],
 *     "condition": "allowedProofs"
 * }]
 * 
 * // Example 4: Unverified document
 * const userProfile = {
 *     "name": "Sarah Johnson",
 *     "documents": {
 *         "aadhaar": {
 *             "type": "aadhaar",
 *             "number": "123456789012",
 *             "verified": false, // Document not verified
 *             "expiryDate": "2025-12-31"
 *         }
 *     }
 * };
 * 
 * const result = await rule.execute(userProfile, criteria, true);
 * // Returns:
 * [{
 *     "type": "userDocument",
 *     "field": "aadhaar",
 *     "reason": "Invalid or unverified document",
 *     "description": "Aadhaar card must be valid and not expired"
 * }]
 */
class UserDocumentRule extends RuleInterface {
  execute(userProfile, criteria, strictCheckingFromQuery, locale = "en") {
    const reasons = [];

    // Use strictChecking from query param if provided, else from criteria
    const strictChecking = typeof strictCheckingFromQuery === 'boolean'
      ? strictCheckingFromQuery
      : Boolean(criteria.strictChecking);

    // Extract the document
    const document = userProfile.documents?.[criteria.documentType];

    // If document is missing or empty
    if (document === undefined || document === null || document === '') {
      if (strictChecking) {
        reasons.push({
          type: "userDocument",
          field: criteria.documentType,
          reason: translate(locale, "errors.missingDocument", { documentType: criteria.documentType }),
          description: criteria.description || "",
        });
      }
      return Promise.resolve(reasons);
    }

    // Allowed proofs check
    if (
      criteria.allowedProofs &&
      !criteria.allowedProofs.includes(document.type)
    ) {
      reasons.push({
        type: "userDocument",
        field: criteria.documentType,
        reason: translate(locale, "errors.documentTypeNotAllowed", { type: document.type }),
        description: criteria.description || "",
        userValue: document.type,
        requiredValue: criteria.allowedProofs,
        condition: "allowedProofs",
      });
      return Promise.resolve(reasons);
    }

    // Document validity check (verified)
    if (strictChecking) {
      return UserDocumentRule.validateDocument(document)
        .then(validity => {
          if (!validity) {
            reasons.push({
              type: "userDocument",
              field: criteria.documentKey,
              reason: translate(locale, "errors.invalidUnverifiedDocument"),
              description: criteria.description || "",
            });
            return Promise.resolve(reasons);
          }

          // Use checkCriteria for other checks (e.g., expiry, etc.)
          if (criteria.condition) {
            const docValue = document[criteria.name];
            return checkCriteria(
              docValue,
              criteria.condition,
              criteria.conditionValues,
              locale
            ).then(isEligible => {
              if (!isEligible) {
                reasons.push({
                  type: "userDocument",
                  field: criteria.name,
                  reason: translate(locale, "errors.doesNotMeetCriteria", { condition: criteria.condition }),
                  description: criteria.description || "",
                  userValue: docValue,
                  requiredValue: criteria.conditionValues,
                  condition: criteria.condition,
                });
              }
              return Promise.resolve(reasons);
            });
          }
          return Promise.resolve(reasons);
        })
        .catch(error => {
          reasons.push({
            type: "userDocument",
            field: criteria.documentType,
            reason: translate(locale, "errors.errorProcessingDocument", { message: error.message }),
            description: criteria.description || "",
          });
          return Promise.resolve(reasons);
        });
    }

    // If not strict checking and we have condition to check
    if (criteria.condition) {
      const docValue = document[criteria.name];
      return checkCriteria(
        docValue,
        criteria.condition,
        criteria.conditionValues,
        locale
      ).then(isEligible => {
        if (!isEligible) {
          reasons.push({
            type: "userDocument",
            field: criteria.name,
            reason: translate(locale, "errors.doesNotMeetCriteria", { condition: criteria.condition }),
            description: criteria.description || "",
            userValue: docValue,
            requiredValue: criteria.conditionValues,
            condition: criteria.condition,
          });
        }
        return Promise.resolve(reasons);
      }).catch(error => {
        reasons.push({
          type: "userDocument",
          field: criteria.documentType,
          reason: translate(locale, "errors.errorProcessingDocument", { message: error.message }),
          description: criteria.description || "",
        });
        return Promise.resolve(reasons);
      });
    }

    return Promise.resolve(reasons);
  }

  // Static method to validate the document
  static validateDocument(document) {
    return Promise.resolve(document.verified === true);
  }
}

module.exports = UserDocumentRule;
