package forge

#ModuleContract: {
	id:         string & =~"^[a-z][a-z0-9-]*$"
	name:       string & != ""
	version:    string & =~"^[0-9]+\\.[0-9]+\\.[0-9]+$"
	status:     #ModuleStatus
	capability: #Capability
	purpose:    string & != ""
	scope: {
		included: [...string]
		excluded: [...string]
	}
	triggers: [...{
		kind:      #TriggerKind
		condition: string & != ""
	}]
	inputs: [...{
		name:        string & =~"^[a-z][a-z0-9_]*$"
		description: string & != ""
		required:    bool
	}]
	procedure: [...{
		id:          string & =~"^[a-z][a-z0-9-]*$"
		description: string & != ""
	}]
	tools: [...string]
	outputs: [...{
		name:        string & =~"^[a-z][a-z0-9_]*$"
		description: string & != ""
	}]
	exit_conditions:         [...string]
	failure_modes:           [...string]
	efficiency_notes:        [...string]
	security_considerations: [...string]
	dependencies:            [...string]
	extensions?: [string]: _
}

#ModuleDocument: {
	module: #ModuleContract
}
