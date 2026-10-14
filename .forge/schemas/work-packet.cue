package forge

#WorkPacket: {
	schemaVersion: 1
	command:       "prepare"
	id:            string & =~"^[a-f0-9]{16}$"
	fingerprint:   string & =~"^[a-f0-9]{64}$"
	cached:        bool
	createdAt:     string & != ""
	task:          string & != ""
	plan:          #OrchestrationPlan
	repository: {
		git: {
			detected:               bool
			branch?:                string & != ""
			commit?:                string & != ""
			dirty:                  bool
			changedFiles:           [...string]
			changedFilesTruncated: bool
		}
		filesScanned: number & >=0
		filesOmitted: number & >=0
		manifests: [...{
			path:   string & != ""
			kind:   string & != ""
			sha256: string & =~"^[a-f0-9]{64}$"
		}]
		languages: [...{
			name:  string & != ""
			files: int & >0
		}]
	}
	projectContext: [string]: _
	commands: [...{
		name:    string & != ""
		command: string & != ""
		source:  string & != ""
	}]
	frameworkReferences: [...string]
	preparation: {
		deterministicWorkCompleted: [string, ...string]
		modelWorkRemaining:          [string, ...string]
		suggestedModelTier:         "economy" | "standard" | "advanced"
		selectedContextCharacters: int & >=0
		maxContextFiles:            int & >0
		maxContextCharacters:       int & >0
	}
	warnings: [...string]
}
