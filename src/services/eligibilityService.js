const {
  checkBenefitEligibility,
} = require("../utils/benefitSchemaEligibility.js");
const logger = require("../utils/logger.js");
const { translate } = require("../utils/i18n.js");

class EligibilityService {
  /**
   * Check eligibility for all provided benefit schemas
   * @param {Object} userProfile - User profile data
   * @param {Array} benefits - Array of benefit schemas
   * @param {Object} eligibilityEvaluationLogic - Optional custom rules
   * @returns {Promise<Object>} Eligibility results
   * @example
   * // Example user profile
   * const userProfile = {
   *     "name": "John Doe",
   *     "gender": "male",
   *     "age": 16,
   *     "dateOfBirth": "2008-01-01",
   *     "caste": "sc",
   *     "income": 400,
   *     "class": "9",
   *     "previousYearMarks": 75,
   *     "state": "maharashtra"
   * };
   * 
   * // Example benefit schema
   * const benefits = [{
   *     "id": "ubi-pilot-scholarship-1",
   *     "eligibility": [
   *         {
   *             "id": "212",  
   *             "type": "userProfile",
   *             "description": "The Total Annual income of parents/guardians of the applicant must not exceed ₹22500/month (i.e. ₹2.7 Lakh per Annum)",
   *             "criteria": {
   *                 "name": "income",
   *                 "condition": "lte",
   *                 "conditionValues": 270000
   *             }
   *         }
   *     ],
   *     "eligibilityEvaluationLogic": "212"
   * }];
   * 
   * // Check eligibility
   * const result = await checkUsersEligibility(userProfile, benefits);
   * // Returns:
   * {
   *     "eligible": [
   *         {
   *             "applicationId": "A123",
   *             "details": {
   *                 "isEligible": true,
   *                 "reasons": [
   *                     "Eligible: All criteria passed"
   *                 ],
   *                 "evaluationResults": {
   *                     "212": true
   *                 },
   *                 "criteriaResults": [
   *                     {
   *                         "ruleKey": 212,
   *                         "passed": true,
   *                         "description": "The Total Annual income of parents/guardians of the applicant must not exceed ₹22500/month (i.e. ₹2.7 Lakh per Annum)",
   *                         "reasons": []
   *                     }
   *                 ]
   *             }
   *         }
   *     ],
   *     "ineligible": [],
   *     "errors": []
   * }
   * 
   * // Example with ineligible case
   * const ineligibleUserProfile = {
   *     "name": "Jane Doe",
   *     "gender": "female",
   *     "age": 14,
   *     "income": 300000,  // Exceeds income limit
   *     "state": "maharashtra"
   * };
   * 
   * const ineligibleResult = await checkUsersEligibility(ineligibleUserProfile, benefits);
   * // Returns:
   * {
   *     "eligibleUsers": [],
   *     "ineligibleUsers": [
   *         {
   *             "applicationId": "A124",
   *             "details": {
   *                 "isEligible": false,
   *                 "reasons": [
   *                     "Income 300000 exceeds the maximum limit of 270000"
   *                 ],
   *                 "evaluationResults": {
   *                     "212": false
   *                 },
   *                 "criteriaResults": [
   *                     {
   *                         "ruleKey": 212,
   *                         "passed": false,
   *                         "description": "The Total Annual income of parents/guardians of the applicant must not exceed ₹22500/month (i.e. ₹2.7 Lakh per Annum)",
   *                         "reasons": ["Income 300000 exceeds the maximum limit of 270000"]
   *                     }
   *                 ]
   *             }
   *         }
   *     ],
   *     "errors": []
   * }
   */
  checkBenefitsEligibility(userProfile, benefits, strictChecking, locale = "en") {
    return Promise.all(
      benefits.map(async (benefit) => {
        try {
          // Get custom evaluation logic if provided
          const eligibilityEvaluationLogic =
            benefit.eligibilityEvaluationLogic ?? null;

          // Get eligibility criteria from the benefit schema
          const benefitCriteria = benefit.eligibility;

          // Check eligibility using the utility function
          const eligibilityResult = await checkBenefitEligibility(
            userProfile,
            benefitCriteria,
            eligibilityEvaluationLogic,
            strictChecking,
            locale
          );

          return {
            schemaId: benefit.id,
            details: eligibilityResult,
            isEligible: eligibilityResult.isEligible,
          };
        } catch (error) {
          logger.error("Error in checkBenefitsEligibility:", error);
          return {
            schemaId: benefit.id || "Unknown",
            error: translate(locale, "errors.errorCheckingCriteria", { message: error.message }),
            isError: true,
          };
        }
      })
    ).then((results) => {
      return results.reduce(
        (acc, result) => {
          if (result.isError) {
            acc.errors.push({
              schemaId: result.schemaId,
              error: result.error,
            });
          } else if (result.isEligible) {
            acc.eligible.push({
              schemaId: result.schemaId,
              details: result.details,
            });
          } else {
            acc.ineligible.push({
              schemaId: result.schemaId,
              details: result.details,
            });
          }
          return acc;
        },
        { eligible: [], ineligible: [], errors: [] }
      );
    });
  }

  /**
   * Check which users are eligible for a specific benefit scheme
   * @param {Array} userProfiles - Array of user profiles
   * @param {Object} scheme - Benefit scheme to check against
   * @returns {Promise<Object>} List of eligible and ineligible users with reasons
   * @example
   * // Example with eligible case
   * const userProfile = [{
   *     "name": "John Doe",
   *     "gender": "male",
   *     "age": 16,
   *     "dateOfBirth": "2008-01-01",
   *     "caste": "sc",
   *     "income": 400,
   *     "class": "9",
   *     "previousYearMarks": 75,
   *     "state": "maharashtra"
   * }];
   * 
   * const benefits = {
   *     "id": "ubi-pilot-scholarship-1",
   *     "eligibility": [
   *         {
   *             "id": "B5",  
   *             "type": "userProfile",
   *             "description": "Gender of Applicant - both male and female allowed to avail scholarship",
   *             "criteria": {
   *                 "name": "gender",
   *                 "condition": "in",
   *                 "conditionValues": [
   *                     "male",
   *                     "female"
   *                 ]
   *             }
   *         },
   *         {
   *             "id": "B2",
   *             "type": "userProfile",
   *             "description": "The applicant must be a student studying in Class 9th to Class 12th",
   *             "criteria": {
   *                 "name": "class",
   *                 "condition": "between",
   *                 "conditionValues": [9, 12]
   *             }
   *         }
   *     ],
   *     "eligibilityEvaluationLogic": "(B5 && B2)"
   * };
   * 
   * const result = await checkUsersEligibility(userProfile, benefits);
   * // Returns:
   * {
   *     "eligibleUsers": [
   *         {
   *             "applicationId": "A123",
   *             "details": {
   *                 "isEligible": true,
   *                 "reasons": [],
   *                 "evaluationResults": {
   *                     "B5": true,
   *                     "B2": true
   *                 },
   *                 "criteriaResults": [
   *                     {
   *                         "ruleKey": "B5",
   *                         "passed": true,
   *                         "description": "Gender of Applicant - both male and female allowed to avail scholarship",
   *                         "reasons": []
   *                     },
   *                     {
   *                         "ruleKey": "B2",
   *                         "passed": true,
   *                         "description": "The applicant must be a student studying in Class 9th to Class 12th",
   *                         "reasons": []
   *                     }
   *                 ]
   *             }
   *         }
   *     ],
   *     "ineligibleUsers": [],
   *     "errors": []
   * }
   * 
   * // Example with ineligible case
   * const ineligibleUserProfile = {
   *     "name": "Jane Doe",
   *     "gender": "female",
   *     "age": 14,
   *     "class": "8",  // Not in required range
   *     "state": "maharashtra"
   * };
   * 
   * const ineligibleResult = await checkUsersEligibility(ineligibleUserProfile, benefits);
   * // Returns:
   * {
   *     "eligibleUsers": [],
   *     "ineligibleUsers": [
   *         {
   *             "applicationId": "A124",
   *             "details": {
   *                 "isEligible": false,
   *                 "reasons": [
   *                     {
   *                         "type": "criteria",
   *                         "reason": "Class 8 is not between 9 and 12",
   *                         "description": "The applicant must be a student studying in Class 9th to Class 12th"
   *                     }
   *                 ],
   *                 "evaluationResults": {
   *                     "B5": true,
   *                     "B2": false
   *                 },
   *                 "criteriaResults": [
   *                     {
   *                         "ruleKey": "B5",
   *                         "passed": true,
   *                         "description": "Gender of Applicant - both male and female allowed to avail scholarship",
   *                         "reasons": []
   *                     },
   *                     {
   *                         "ruleKey": "B2",
   *                         "passed": false,
   *                         "description": "The applicant must be a student studying in Class 9th to Class 12th",
   *                         "reasons": ["Class 8 is not between 9 and 12"]
   *                     }
   *                 ]
   *             }
   *         }
   *     ],
   *     "errors": []
   * }
   */
  checkUsersEligibility(userProfiles, benefit, strictChecking, locale = "en") {
    return Promise.all(
      userProfiles.map(async (userProfile) => {
        try {
          // Get custom evaluation logic if provided
          const eligibilityEvaluationLogic =
            benefit.eligibilityEvaluationLogic ?? null;

          // Get eligibility criteria from the benefit schema
          const benefitCriteria = benefit.eligibility;

          // Check eligibility using the utility function
          const eligibilityResult = await checkBenefitEligibility(
            userProfile,
            benefitCriteria,
            eligibilityEvaluationLogic,
            strictChecking,
            locale
          );

          return {
            applicationId: userProfile.applicationId,
            details: eligibilityResult,
            isEligible: eligibilityResult.isEligible,
          };
        } catch (error) {
          logger.error("Error in checkUsersEligibility:", error);
          return {
            applicationId: userProfile.applicationId || "Unknown",
            error: translate(locale, "errors.errorCheckingCriteria", { message: error.message }),
            isError: true,
          };
        }
      })
    ).then((results) => {
      return results.reduce(
        (acc, result) => {
          if (result.isError) {
            acc.errors.push({
              applicationId: result.applicationId,
              error: result.error,
            });
          } else if (result.isEligible) {
            acc.eligibleUsers.push({
              applicationId: result.applicationId,
              details: result.details,
            });
          } else {
            acc.ineligibleUsers.push({
              applicationId: result.applicationId,
              details: result.details,
            });
          }
          return acc;
        },
        { eligibleUsers: [], ineligibleUsers: [], errors: [] }
      );
    });
  }
}

module.exports = new EligibilityService();
