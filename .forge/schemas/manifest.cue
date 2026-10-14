package forge

#Manifest: {
	forge: {
		name:    "gODtECH FORGE"
		version: string & != ""
		role:    "development-framework"
		source?: string & != ""
		attribution: {
			readme:   "required"
			metadata: "required"
			ui:       "optional" | "enabled"
		}
	}

	project: {
		name:           string & != ""
		initialized_at: string & != ""
		last_synced_at: string & != ""
		installation:   "cli" | "template" | "manual"
		extensions?: [string]: _
	}
}
