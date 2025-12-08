const fastify = require("fastify")({ logger: true });
const cors = require("@fastify/cors");
const swagger = require("@fastify/swagger");
const swaggerUI = require("@fastify/swagger-ui");
const eligibilityService = require("./services/eligibilityService");
const swaggerConfig = require("./config/swagger");
const benefitEligibleSchema = require("./schemas/check-eligibility-schema");
const userEligibilitySchema = require("./schemas/check-users-eligibility-schema");
const { translate } = require("./utils/i18n");

// Register plugins
fastify.register(cors, {
  origin: "*",
});

// Register Swagger
fastify.register(swagger, {
  openapi: swaggerConfig,
});

// Register Swagger UI
fastify.register(swaggerUI, {
  routePrefix: "/documentation",
  uiConfig: {
    docExpansion: "list",
    deepLinking: false,
  },
  staticCSP: true,
  transformStaticCSP: (header) => header,
});

// Helper function to extract locale from request
function getLocale(request) {
  // Check query parameter first
  const queryLocale = request.query?.locale || request.query?.lang;
  if (queryLocale && ["en", "hi"].includes(queryLocale)) {
    return queryLocale;
  }
  
  // Check Accept-Language header
  const acceptLanguage = request.headers["accept-language"];
  if (acceptLanguage) {
    const lang = acceptLanguage.split(",")[0].split("-")[0].toLowerCase();
    if (["en", "hi"].includes(lang)) {
      return lang;
    }
  }
  
  // Default to English
  return "en";
}

// Health check route
fastify.get(
  "/health",
  {
    schema: {
      tags: ["System"],
      summary: "Health check endpoint",
      description: "Returns the health status of Eligibility SDK service",
      response: {
        200: {
          type: "object",
          properties: {
            status: {
              type: "string",
              enum: ["ok"],
              description: "Health status",
            },
          },
        },
      },
    },
  },
  (request, reply) => {
    return { status: "ok" };
  }
);

fastify.setErrorHandler((error, request, reply) => {
  const locale = getLocale(request);
  
  if (error.validation) {
    // This is a validation error (400)
    request.log.error(
      { validation: error.validation },
      translate(locale, "errors.schemaValidationFailed")
    );

    return reply.status(400).send({ 
      error: translate(locale, "errors.badRequest"),
      message: error.message,
      details: error.validation,
    });
  }
  request.log.error(error);
  return reply.status(error.statusCode || 500).send({ 
    error: translate(locale, "errors.internalServerError"),
    message: error.message,
  });
});

// Main eligibility check endpoint
fastify.post(
  "/check-eligibility",
  {
    schema: { 
      ...benefitEligibleSchema,
      querystring: { 
        type: "object",
        properties: {
          strictChecking: {
            type: "boolean",
            default: false,
            description: "Enable strict eligibility checking",
          },
          locale: {
            type: "string",
            enum: ["en", "hi"],
            description: "Language locale (en for English, hi for Hindi)",
          },
        },
        additionalProperties: false, 
      },
    },
  },
  (request, reply) => {
    const strictChecking = Boolean(request.query.strictChecking);
    const locale = getLocale(request);
    const { userProfile, benefitsList } = request.body;

    return eligibilityService.checkBenefitsEligibility(
      userProfile,
      benefitsList,
      strictChecking,
      locale
    ).catch(error => {
      request.log.error(error);
      return reply.status(error.statusCode ?? 500).send({
        error: translate(locale, "errors.internalServerError"),
        message: error.message,
      });
    });
  }
);

// List user profiles for a scheme endpoint
fastify.post(
  "/check-users-eligibility",
  {
    schema: {
      ...userEligibilitySchema,
      querystring: { 
        type: "object",
        properties: {
          strictChecking: {
            type: "boolean",
            default: false,
            description: "Enable strict eligibility checking",
          },
          locale: {
            type: "string",
            enum: ["en", "hi"],
            description: "Language locale (en for English, hi for Hindi)",
          },
        },
        additionalProperties: false, 
      },
    },
  },
  (request, reply) => {
    const strictChecking = Boolean(request.query.strictChecking);
    const locale = getLocale(request);
    const { userProfiles, benefitSchema } = request.body;

    // Check if eligibility criteria is an array
    const benefitCriteria = Array.isArray(benefitSchema?.eligibility) 
      ? [...benefitSchema.eligibility]
      : [];

    return eligibilityService.checkUsersEligibility(
      userProfiles,
      { ...benefitSchema, eligibility: benefitCriteria },
      strictChecking,
      locale
    ).catch(error => {
      request.log.error(error);
      return reply.status(error.statusCode ?? 500).send({
        error: translate(locale, "errors.internalServerError"),
        message: error.message,
      });
    });
  }
);

// Start server
const start = () => {
  const port = process.env.PORT || 3011;
  
  return fastify.ready()
    .then(() => fastify.listen({ port: port, host: "0.0.0.0" }))
    .then(() => {
      fastify.log.info(`Server is running on ${fastify.server.address().port}`);
    })
    .catch(error => {
      fastify.log.error(error);
      process.exit(1);
    });
};

start();
