package forge

#PrepareMetricEvent: {
	schemaVersion: 1
	event:         "prepare"
	recordedAt:    string & != ""
	cacheHit:      bool
	taskKind:      "documentation" | "research" | "security" | "infrastructure" | "bug" | "refactor" | "feature"
	risk:          #RiskLevel
	suggestedModelTier: "economy" | "standard" | "advanced"
	durationMs:                   number & >=0
	candidateContextCharacters:  int & >=0
	selectedContextCharacters:   int & >=0
	filesScanned:                int & >=0
	commandsDiscovered:          int & >=0
	frameworkReferencesSelected: int & >=0
	deterministicStepsCompleted: int & >=0
}
