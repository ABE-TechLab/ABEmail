package forge

#Evidence: {
	id:           string & =~"^evidence-[a-z0-9][a-z0-9-]*$"
	kind:         #EvidenceKind
	summary:      string & != ""
	source:       string & != ""
	collected_at: string & != ""
	hash?:        string & != ""
	metadata?: [string]: _
}

#Decision: {
	id:       string & =~"^decision-[a-z0-9][a-z0-9-]*$"
	title:    string & != ""
	status:   #DecisionStatus
	risk:     #RiskLevel
	context:  string & != ""
	decision: string & != ""
	alternatives: [...{
		option: string & != ""
		reason: string & != ""
	}]
	consequences: [...string]
	evidence_ids: [...string]
	decided_at:   string & != ""
	approved_by?: string & != ""
	extensions?: [string]: _
}

#DecisionRecord: {
	evidence: #Evidence
	decision: #Decision
}
