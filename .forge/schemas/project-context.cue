package forge

#ProjectContext: {
	project: {
		name:   string & != ""
		status: #ProjectStatus
		owner?: string & != ""
	}

	product: {
		problem:           string
		users:             [...string]
		value_proposition: string
		goals:             [...string]
		non_goals:         [...string]
	}

	market: {
		geography:       string
		segment:         string
		competitors:     [...string]
		differentiation: string
		evidence:        [...string]
	}

	experience: {
		platforms:                  [...string]
		ux_priorities:              [...string]
		ui_direction:               string
		accessibility_requirements: [...string]
	}

	technical: {
		architecture: string
		stack:        [...string]
		integrations: [...string]
		constraints:  [...string]
	}

	security: {
		risk_level:              #RiskLevel
		sensitive_data:          [...string]
		compliance_requirements: [...string]
	}

	operations: {
		deployment_target:          string
		environments:               [...string]
		observability_requirements: [...string]
	}

	branding: {
		product_identity: string
		forge_provenance: {
			readme:   "required"
			metadata: "required"
			ui:       "optional" | "enabled"
			wording:  string & != ""
		}
	}

	forge: {
		active_modules: [...#Capability]
		open_questions: [...string]
		material_risks: [...string]
		last_updated:   string
		extensions?: [string]: _
	}
}
