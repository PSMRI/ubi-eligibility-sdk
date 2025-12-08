const { checkCriteria } = require("../../utils/eligibilityUtils");
const RuleInterface = require("../interfaces/RuleInterface");
const { translate } = require("../../utils/i18n");

/**
 * Rule class for checking user profile criteria
 * @class
 * @extends RuleInterface
 * @example
 * // Example 1: Income check with strict checking
 * const userProfile = {
 *     "name": "John Doe",
 *     "income": 400000
 * };
 * 
 * const criteria = {
 *     "name": "income",
 *     "condition": "lte",
 *     "conditionValues": 270000,
 *     "description": "The Total Annual income must not exceed ₹2.7 Lakh per Annum",
 *     "strictChecking": true
 * };
 * 
 * const rule = new UserProfileRule();
 * const result = await rule.execute(userProfile, criteria, true);
 * // Returns:
 * [{
 *     "type": "userProfile",
 *     "field": "income",
 *     "reason": "Does not meet criteria: lte",
 *     "description": "The Total Annual income must not exceed ₹2.7 Lakh per Annum",
 *     "userValue": 400000,
 *     "requiredValue": 270000,
 *     "condition": "lte"
 * }]
 * 
 * // Example 2: Age check with missing field
 * const userProfile = {
 *     "name": "Jane Doe"
 *     // age field is missing
 * };
 * 
 * const criteria = {
 *     "name": "age",
 *     "condition": "gte",
 *     "conditionValues": 18,
 *     "description": "Applicant must be at least 18 years old",
 *     "strictChecking": true
 * };
 * 
 * const result = await rule.execute(userProfile, criteria, true);
 * // Returns:
 * [{
 *     "type": "userProfile",
 *     "field": "age",
 *     "reason": "Missing required userProfile field: age",
 *     "description": "Applicant must be at least 18 years old"
 * }]
 * 
 * // Example 3: Class check with non-strict checking
 * const userProfile = {
 *     "name": "Mike Smith",
 *     "class": "8"
 * };
 * 
 * const criteria = {
 *     "name": "class",
 *     "condition": "between",
 *     "conditionValues": [9, 12],
 *     "description": "Student must be in class 9-12",
 *     "strictChecking": false
 * };
 * 
 * const result = await rule.execute(userProfile, criteria, false);
 * // Returns:
 * [{
 *     "type": "userProfile",
 *     "field": "class",
 *     "reason": "Does not meet criteria: between",
 *     "description": "Student must be in class 9-12",
 *     "userValue": "8",
 *     "requiredValue": [9, 12],
 *     "condition": "between"
 * }]
 * 
 * // Example 4: Successful check
 * const userProfile = {
 *     "name": "Sarah Johnson",
 *     "income": 200000
 * };
 * 
 * const criteria = {
 *     "name": "income",
 *     "condition": "lte",
 *     "conditionValues": 270000,
 *     "description": "The Total Annual income must not exceed ₹2.7 Lakh per Annum",
 *     "strictChecking": true
 * };
 * 
 * const result = await rule.execute(userProfile, criteria, true);
 * // Returns:
 * [] // Empty array means all criteria passed
 */
class UserProfileRule extends RuleInterface {
  execute(userProfile, criteria, strictCheckingFromQuery, locale = "en") {
    const reasons = [];

    // Use strictChecking from query param if provided, else from criteria
    const strictChecking = typeof strictCheckingFromQuery === 'boolean'
      ? strictCheckingFromQuery
      : Boolean(criteria.strictChecking);

    // Extract the value from userProfile based on criteria name
    const value = userProfile[criteria.name];
    if (value === undefined || value === null || value === '') {
      if (strictChecking) {
        reasons.push({
          type: "userProfile",
          field: criteria.name,
          reason: translate(locale, "errors.missingUserProfileField", { field: criteria.name }),
          description: criteria.description || "",
        });
      }
      return Promise.resolve(reasons);
    }

    return checkCriteria(
      value,
      criteria.condition,
      criteria.conditionValues,
      locale
    ).then(isEligible => {
      if (!isEligible) {
        reasons.push({
          type: "userProfile",
          field: criteria.name,
          reason: translate(locale, "errors.doesNotMeetCriteria", { condition: criteria.condition }),
          description: criteria.description || "",
          userValue: value,
          requiredValue: criteria.conditionValues,
          condition: criteria.condition,
        });
      }
      return reasons;
    }).catch(error => {
      reasons.push({
        type: "userProfile",
        field: criteria.name,
        reason: translate(locale, "errors.errorCheckingCriteria", { message: error.message }),
        description: criteria.description || "",
      });
      return reasons;
    });
  }
}

module.exports = UserProfileRule;
