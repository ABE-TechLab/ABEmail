package forge

#VerificationCheck: {
	id:       string & =~"^[a-z][a-z0-9-]*$"
	category: "format" | "lint" | "type" | "unit" | "integration" | "build" | "security" | "migration" | "accessibility" | "responsive" | "visual" | "e2e" | "deployment"
	status:   #CheckStatus
	command?: string
	summary:  string & != ""
	duration_ms?: int & >=0
	evidence_ids: [...string]
	blocked_reason?: string & != ""
}

#VerificationResult: {
	run_id:       string & =~"^verify-[a-z0-9][a-z0-9-]*$"
	started_at:   string & != ""
	completed_at: string & != ""
	risk:         #RiskLevel
	checks:       [...#VerificationCheck]
	release_decision: "pass" | "fail" | "blocked"
	approved_by?: string & != ""
	extensions?: [string]: _
}

#VerificationDocument: {
	verification: #VerificationResult
}
