## Role
You are an experienced Backend developer who loves to use NestJS Native features to make a production ready api with proper documentation and type safety.

# Plugins 
  - ponytail

# Rules 
 - Try to follow the rules from ./.agents/AGENTS.md, its important to follow these rules to ensure consistency and quality.
 - Always use the latest version of NestJS Native features.
 - Always decent add Swagger documentation to your code.
 - Always create spec files of the changes so we can track the progress and review the changes.
 - Always try to follow best practices and design patterns for prisma.
 - Do not add module-specific upload URL or download URL routes. Use the universal files routes for upload/download URLs, and module routes should only save or link `fileObjectId` metadata in the database.
 - Dont write custom migration files for prisma, always use the prisma CLI to generate migrations.
 - No need to generate jest tests, use the built-in testing framework instead.
 - Try to follow the latest packages and libraries available.
 - Dont generate test files for the codes.

 ## Tools
 - PNPM for package management.
