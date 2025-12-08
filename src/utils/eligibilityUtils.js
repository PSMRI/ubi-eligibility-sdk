const { translate } = require("./i18n");

/**
 * Check a single criteria against user value
 * @param {*} userValue - User's value for the criteria
 * @param {string|object} condition - Condition to check
 * @param {*} conditionValues - Values to compare against
 * @param {string} locale - Locale for error messages (default: "en")
 * @returns {Promise<boolean>} Whether criteria is met
 * @example
 * // Number comparison
 * checkCriteria(5, "gte", 3)  // returns true
 * checkCriteria("5", "gte", 3)  // returns true
 * checkCriteria([5], "gte", 3)  // returns true
 * 
 * // String comparison
 * checkCriteria("John", "equals", "John")  // returns true
 * checkCriteria("john", "equals", "John")  // returns false (case sensitive)
 * 
 * // Array inclusion
 * checkCriteria("apple", "in", ["apple", "banana"])  // returns true
 * 
 * // Between range
 * checkCriteria(5, "between", [1, 10])  // returns true
 * 
 * // Boolean comparison
 * checkCriteria(true, "equals", "true")  // returns true
 * 
 * // Object condition
 * checkCriteria(5, { condition: "gte" }, 3)  // returns true
 */
function checkCriteria(userValue, condition, conditionValues, locale = "en") {
  return new Promise((resolve, reject) => {
    try {
      // check condition value array or single value
      // find condition datatype e.g int or string and convert userValue to that type
      if (!condition)
        throw new Error(translate(locale, "errors.conditionRequired"));

      let conditionStr;
      if (typeof condition === "object") {
        conditionStr = condition.condition || condition?.criteria?.condition;
        if (!conditionStr) throw new Error(translate(locale, "errors.invalidConditionStructure"));
      } else {
        conditionStr = condition;
      }

      conditionStr = conditionStr.toLowerCase().trim().replace(/\s+/g, '');

      // Helper function to convert value to appropriate type
      const convertToType = (value, type) => {
        if (Array.isArray(value)) {
          value = value[0];
        }
        switch (type) {
          case 'number':
            return Number(value);
          case 'string':
            // Convert strings to lowercase for case-insensitive comparison
            return String(value).toLowerCase();
          case 'boolean':
            return Boolean(value);
          default:
            return value;
        }
      };

      // Detect type from conditionValues
      const detectType = (value) => {
        if (Array.isArray(value)) {
          value = value[0];
        }
        if (!isNaN(value) && value !== '') {
          return 'number';
        }
        if (value === 'true' || value === 'false') {
          return 'boolean';
        }
        return 'string';
      };

      const valueType = detectType(conditionValues);
      const convertedUserValue = convertToType(userValue, valueType);
      const convertedConditionValue = convertToType(conditionValues, valueType);

      let result;
      switch (conditionStr) {
        case "equals":
        case "equal":
        case "=":
        case "==":
          result = convertedUserValue === convertedConditionValue;
          break;

        case "in":
        case "includes":
          result = (
            Array.isArray(conditionValues) &&
            conditionValues.map(v => convertToType(v, valueType)).includes(convertedUserValue)
          );
          break;

        case "greaterthanequals":
        case "greaterthanequal":
        case "gte":
        case ">=":
          result = convertedUserValue >= convertedConditionValue;
          break;

        case "lessthanequals":
        case "lessthanequal":
        case "lte":
        case "<=":
          result = convertedUserValue <= convertedConditionValue;
          break;

        case "greaterthan":
        case "gt":
        case ">":
          result = convertedUserValue > convertedConditionValue;
          break;

        case "lessthan":
        case "lt":
        case "<":
          result = convertedUserValue < convertedConditionValue;
          break;

        case "between": {
          if (!Array.isArray(conditionValues) || conditionValues.length !== 2)
            throw new Error(translate(locale, "errors.betweenConditionRequiresArray"));

          const [min, max] = conditionValues.map(v => convertToType(v, valueType));
          result = convertedUserValue >= min && convertedUserValue <= max;
          break;
        }

        default:
          throw new Error(translate(locale, "errors.unsupportedCondition", { condition: conditionStr }));
      }

      resolve(result);
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = {
  checkCriteria,
};
