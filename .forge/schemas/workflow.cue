package forge

#WorkflowStep: {
	id:          string & =~"^[a-z][a-z0-9-]*$"
	action:      string & != ""
	capability?: #Capability
	approval:    #ApprovalMode
	on_failure:  "stop" | "continue" | "request-human"
}

#WorkflowContract: {
	id:          string & =~"^[a-z][a-z0-9-]*$"
	name:        string & != ""
	version:     string & =~"^[0-9]+\\.[0-9]+\\.[0-9]+$"
	description: string & != ""
	stages:      [...#LifecycleStage]
	risk: {
		minimum: #RiskLevel
	}
	inputs: [...{
		name:     string & =~"^[a-z][a-z0-9_]*$"
		required: bool
	}]
	steps: [...#WorkflowStep]
	outputs: [...{
		name: string & =~"^[a-z][a-z0-9_]*$"
	}]
	exit_conditions: [...string]
	extensions?: [string]: _
}

#WorkflowDocument: {
	workflow: #WorkflowContract
}
