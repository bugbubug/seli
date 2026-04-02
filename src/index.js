const { createPlan, explainPlan } = require('./plan');
const { executePlan } = require('./apply');
const { explainDoctor, runDoctor } = require('./doctor');

function planProject(options) {
  return createPlan({
    command: 'plan',
    ...options
  });
}

function initProject(options) {
  const plan = createPlan({
    command: 'init',
    ...options
  });
  const result = executePlan(plan, options);
  return { plan, result };
}

function updateProject(options) {
  const plan = createPlan({
    command: 'update',
    ...options
  });
  const result = executePlan(plan, options);
  return { plan, result };
}

module.exports = {
  createPlan,
  executePlan,
  explainDoctor,
  explainPlan,
  initProject,
  planProject,
  runDoctor,
  updateProject
};
