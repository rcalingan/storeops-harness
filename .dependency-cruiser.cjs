/**
 * Architecture rules for StoreOps, enforced by `npm run lint:deps`.
 * @type {import('dependency-cruiser').IConfiguration}
 */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Circular dependencies are forbidden anywhere in src.',
      from: {},
      to: { circular: true },
    },
    {
      name: 'no-cross-module-repository',
      severity: 'error',
      comment:
        'Module boundary: a module may never import another module\'s repository. ' +
        'Cross-module reads go through the target module\'s service layer.',
      from: { path: '^src/modules/([^/]+)/' },
      to: { path: '^src/modules/[^/]+/[^/]+\.repository\.ts$', pathNot: '^src/modules/$1/' },
    },
    {
      name: 'no-direct-alerts-import',
      severity: 'error',
      comment: 'Event bus only: other modules must trigger alerts via EventBus.emit(), never by importing the alerts module.',
      from: { path: '^src/modules/(?!alerts/)' },
      to: { path: '^src/modules/alerts/' },
    },
    {
      name: 'no-direct-reports-import',
      severity: 'error',
      comment: 'Event bus only: other modules must trigger reports via EventBus.emit(), never by importing the reports module.',
      from: { path: '^src/modules/(?!reports/)' },
      to: { path: '^src/modules/reports/' },
    },
    {
      name: 'routes-not-to-repository',
      severity: 'error',
      comment: 'Layer separation: routes talk to services only — no skipping straight to a repository.',
      from: { path: '\.(routes|events|auth)\.ts$' },
      to: { path: '\.repository\.ts$' },
    },
    {
      name: 'repository-is-a-leaf',
      severity: 'error',
      comment: 'Layer separation: repositories must not call services, routes, the event bus or HTTP libraries.',
      from: { path: '\.repository\.ts$' },
      to: { path: '(\.(service|routes|events|auth)\.ts$)|(^src/shared/(events|http)/)|(node_modules/express)' },
    },
    {
      name: 'service-not-to-http',
      severity: 'error',
      comment: 'Layer separation: services hold business logic and must stay HTTP-agnostic.',
      from: { path: '\.service\.ts$' },
      to: { path: '(\.(routes|auth)\.ts$)|(^src/shared/http/)|(node_modules/express)' },
    },
    {
      name: 'shared-not-to-modules',
      severity: 'error',
      comment: 'Shared kernel may only depend on module type definitions, never on module implementations.',
      from: { path: '^src/shared/' },
      to: { path: '^src/modules/', pathNot: '\.types\.ts$' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: { exportsFields: ['exports'], conditionNames: ['import', 'require', 'node', 'default'] },
  },
};
