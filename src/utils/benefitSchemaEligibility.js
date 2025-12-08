const vm = require("vm");
const logger = require("../utils/logger");
const { translate } = require("../utils/i18n");

/**
 * Check eligibility for a single benefit schema
 * @param {Object} userProfile - User profile data
 * @param {Array} benefit - Array of eligibility conditions
 * @param {string} eligibilityEvaluationLogic - Optional custom evaluation logic
 * @param {boolean} strictChecking - Whether to perform strict checking
 * @returns {Promise<Object>} Eligibility result with reasons and evaluation details
 * @example
 * // Example user profile
 * const userProfile = {
 *     "name": "John Doe",
 *     "gender": "male",
 *     "age": 16,
 *     "income": 400,
 *     "class": "9",
 *     "state": "maharashtra"
 * };
 * 
 * // Example benefit schema with eligibility conditions
 * const benefit = [
 *     {
 *         "id": "212",
 *         "type": "userProfile",
 *         "description": "The Total Annual income of parents/guardians of the applicant must not exceed ₹22500/month (i.e. ₹2.7 Lakh per Annum)",
 *         "criteria": {
 *             "id": "212",
 *             "name": "income",
 *             "condition": "lte",
 *             "conditionValues": 270000
 *         }
 *     },
 *     {
 *         "id": "213",
 *         "type": "userProfile",
 *         "description": "The applicant must be studying in Class 9th to 12th",
 *         "criteria": {
 *             "id": "213",
 *             "name": "class",
 *             "condition": "between",
 *             "conditionValues": [9, 12]
 *         }
 *     }
 * ];
 * 
 * // Example with simple eligibility logic
 * const result = await checkBenefitEligibility(userProfile, benefit, "212 && 213");
 * // Returns:
 * {
 *     "isEligible": true,
 *     "reasons": ["Eligible: All criteria passed"],
 *     "evaluationResults": {
 *         "212": true,
 *         "213": true
 *     },
 *     "criteriaResults": [
 *         {
 *             "ruleKey": "212",
 *             "passed": true,
 *             "description": "The Total Annual income of parents/guardians of the applicant must not exceed ₹22500/month (i.e. ₹2.7 Lakh per Annum)",
 *             "reasons": []
 *         },
 *         {
 *             "ruleKey": "213",
 *             "passed": true,
 *             "description": "The applicant must be studying in Class 9th to 12th",
 *             "reasons": []
 *         }
 *     ]
 * }
 * 
 * // Example with ineligible case
 * const ineligibleUserProfile = {
 *     "name": "Jane Doe",
 *     "gender": "female",
 *     "age": 14,
 *     "income": 300000,  // Exceeds income limit
 *     "class": "8",      // Below required class
 *     "state": "maharashtra"
 * };
 * 
 * const ineligibleResult = await checkBenefitEligibility(ineligibleUserProfile, benefit, "212 && 213");
 * // Returns:
 * {
 *     "isEligible": false,
 *     "reasons": [
 *         {
 *             "type": "userProfile",
 *             "reason": "Income 300000 exceeds the maximum limit of 270000",
 *             "description": "The Total Annual income of parents/guardians of the applicant must not exceed ₹22500/month (i.e. ₹2.7 Lakh per Annum)"
 *         },
 *         {
 *             "type": "userProfile",
 *             "reason": "Class 8 is not between 9 and 12",
 *             "description": "The applicant must be studying in Class 9th to 12th"
 *         }
 *     ],
 *     "evaluationResults": {
 *         "212": false,
 *         "213": false
 *     },
 *     "criteriaResults": [
 *         {
 *             "ruleKey": "212",
 *             "passed": false,
 *             "description": "The Total Annual income of parents/guardians of the applicant must not exceed ₹22500/month (i.e. ₹2.7 Lakh per Annum)",
 *             "reasons": ["Income 300000 exceeds the maximum limit of 270000"]
 *         },
 *         {
 *             "ruleKey": "213",
 *             "passed": false,
 *             "description": "The applicant must be studying in Class 9th to 12th",
 *             "reasons": ["Class 8 is not between 9 and 12"]
 *         }
 *     ]
 * }
 * 
 * // Example with invalid eligibility logic
 * const invalidLogicResult = await checkBenefitEligibility(userProfile, benefit, "212 && B1");
 * // Returns:
 * {
 *     "isEligible": false,
 *     "reasons": [
 *         {
 *             "type": "eligibilityEvaluationLogic",
 *             "reason": "Error evaluating eligibilityEvaluationLogic: B1 is not defined",
 *             "description": "212 && B1"
 *         }
 *     ],
 *     "evaluationResults": {
 *         "212": true,
 *         "213": true
 *     },
 *     "criteriaResults": [
 *         {
 *             "ruleKey": "212",
 *             "passed": true,
 *             "description": "The Total Annual income of parents/guardians of the applicant must not exceed ₹22500/month (i.e. ₹2.7 Lakh per Annum)",
 *             "reasons": []
 *         },
 *         {
 *             "ruleKey": "213",
 *             "passed": true,
 *             "description": "The applicant must be studying in Class 9th to 12th",
 *             "reasons": []
 *         }
 *     ]
 * }
 */
function checkBenefitEligibility(
  userProfile,
  benefit,
  eligibilityEvaluationLogic,
  strictChecking,
  locale = "en"
) {
  // Ensure strictChecking is a boolean
  const isStrictChecking = Boolean(strictChecking);
  // Check if benefit is defined and is an array
  if (!benefit || !Array.isArray(benefit)) { 
    return Promise.resolve({
      isEligible: false,
      reasons: [translate(locale, "errors.noEligibilityCriteria")],
    });
  }

  const reasons = [];
  const evaluationResults = {};
  const criteriaResults = [];

  // Process all conditions sequentially
  return benefit.reduce((promiseChain, condition) => {
    return promiseChain.then(async () => {
      const { type, description, criteria } = condition;

      // Convert type to RuleClassName (e.g., "age" to "AgeRule")
      const RuleClassName = type  + "Rule"; 

      // Dynamically require the rule class based on type
      const RuleClass = require(`../services/rules/${RuleClassName}`); 

      // If no rule class is found, log the reason and continue
      if (!RuleClass) {
        reasons.push({
          type,
          reason: translate(locale, "errors.noRuleClassFound", { type }),
          description,
        });
        return;
      }

      let passed = true;
      let ruleReasons = [];
      const ruleInstance = new RuleClass();

      // Execute the rule criteria
      ruleReasons = await ruleInstance.execute( 
        userProfile,
        criteria,
        isStrictChecking,
        locale
      );

      // If ruleReasons are present, it means the rule did not pass
      if (ruleReasons.length > 0) { 
        passed = false;
        reasons.push(...ruleReasons);
      }

      // Use criteria.id as the key for evaluation results
      const ruleKey = criteria.name;
      evaluationResults[ruleKey] = passed;
      criteriaResults.push({
        ruleKey,
        passed,
        description,
        reasons: ruleReasons,
      });
    });
  }, Promise.resolve())
  .then(() => {
    // If eligibilityEvaluationLogic is present, evaluate it
    if (eligibilityEvaluationLogic) {
      let isEligible = false;
      let customRuleMessage = "";
      try {
        // Use vm to safely evaluate the eligibility logic
        isEligible = vm.runInNewContext( 
          eligibilityEvaluationLogic,
          evaluationResults
        );

        if (isEligible) {
          customRuleMessage = translate(locale, "success.eligibleCustomRule", {
            rule: eligibilityEvaluationLogic,
            results: JSON.stringify(evaluationResults)
          });
        }
      } catch (err) {
        reasons.push({
          type: "eligibilityEvaluationLogic",
          reason: translate(locale, "errors.errorEvaluatingLogic", { message: err.message }),
          description: eligibilityEvaluationLogic,
        });
        logger.error("Error evaluating eligibilityEvaluationLogic:", err);
      }
      return {
        isEligible,
        reasons: isEligible ? [customRuleMessage] : reasons,
        evaluationResults,
        criteriaResults,
      };
    }

    // Default: eligible if no reasons
    return {
      isEligible: reasons.length === 0,
      reasons: reasons.length > 0 ? reasons : [translate(locale, "success.eligibleAllCriteriaPassed")],
      evaluationResults,
      criteriaResults,
    };
  });
}

module.exports = {
  checkBenefitEligibility,
};
