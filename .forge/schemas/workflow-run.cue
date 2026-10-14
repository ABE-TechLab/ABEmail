package forge

#RunStatus: "awaiting-approval" | "in-progress" | "completed"
#TaskKind: "documentation" | "research" | "security" | "infrastructure" | "bug" | "refactor" | "feature"
#WorkflowName: "lightweight-delivery" | "standard-delivery" | "secure-delivery" | "research"

#RunApproval: {
	id:          string & =~"^[a-z][a-z0-9-]*$"
	reason:      string & != ""
	required:    true
	approvedAt?: string & != ""
	approvedBy?: string & != ""
}

#PlanStep: {
	id:         string & =~"^[a-z][a-z0-9-]*$"
	stage:      string & != ""
	action:     string & != ""
	capability: #Capability
}

#OrchestrationPlan: {
	command:      "plan"
	task:         string & != ""
	taskKind:     #TaskKind
	risk:         #RiskLevel
	workflow:     #WorkflowName
	signals:      [...string]
	capabilities: [...{
		capability: #Capability
		reasons:    [string, ...string]
	}]
	approvals: [...#RunApproval]
	steps:     [#PlanStep, ...#PlanStep]
}

#WorkflowRun: {
	schemaVersion: 1
	id:            string & =~"^[A-Za-z0-9][A-Za-z0-9._-]{0,100}$"
	status:        #RunStatus
	createdAt:     string & != ""
	updatedAt:     string & != ""
	task:          string & != ""
	plan:          #OrchestrationPlan
	approvals: [...#RunApproval]
	completedSteps: [...{
		stepId:      string & =~"^[a-z][a-z0-9-]*$"
		evidence:    string & != ""
		completedAt: string & != ""
	}]
}
