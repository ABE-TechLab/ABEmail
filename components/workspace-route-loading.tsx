import styles from "./workspace-route-loading.module.css";

type WorkspaceLoadingVariant = "mail" | "settings" | "feature";

export default function WorkspaceRouteLoading({
  variant = "feature",
}: {
  variant?: WorkspaceLoadingVariant;
}) {
  return (
    <section className={styles.page} role="status" aria-busy="true" aria-label="Loading workspace page">
      <span className={styles.screenReader}>Loading page content…</span>
      <header className={styles.topbar} aria-hidden="true">
        <div className={styles.breadcrumb}>
          <span className={styles.shortBar} />
          <span className={styles.separator}>/</span>
          <span className={styles.mediumBar} />
        </div>
        <span className={styles.avatar} />
      </header>

      {variant === "mail" ? (
        <>
          <div className={styles.mailHeading} aria-hidden="true">
            <span className={styles.titleBar} />
            <span className={styles.subtitleBar} />
            <div className={styles.mailTools}>
              <span className={styles.toolBar} />
              <span className={styles.toolBar} />
              <span className={styles.toolBar} />
            </div>
          </div>
          <div className={styles.mailLayout} aria-hidden="true">
            <div className={styles.panel}>
              <div className={styles.panelHeading}><span className={styles.mediumBar} /><span className={styles.shortBar} /></div>
              {Array.from({ length: 7 }, (_, index) => (
                <div className={styles.messageRow} key={index}>
                  <span className={styles.senderBar} />
                  <span className={styles.subjectBar} />
                  <span className={styles.previewBar} />
                </div>
              ))}
            </div>
            <div className={styles.panel}>
              <div className={styles.messageDetailHeading}>
                <span className={styles.titleBar} />
                <span className={styles.mediumBar} />
                <span className={styles.shortBar} />
              </div>
              <div className={styles.messageBody}>
                <span className={styles.bodyBar} />
                <span className={styles.bodyBar} />
                <span className={styles.bodyBar} />
                <span className={styles.bodyBarShort} />
                <span className={styles.bodyBar} />
                <span className={styles.bodyBarMedium} />
              </div>
            </div>
          </div>
        </>
      ) : variant === "settings" ? (
        <>
          <div className={styles.pageHeading} aria-hidden="true">
            <span className={styles.titleBar} />
            <span className={styles.subtitleBar} />
          </div>
          <div className={styles.settingsLayout} aria-hidden="true">
            <div className={styles.panel}>
              {Array.from({ length: 9 }, (_, index) => (
                <span className={styles.navBar} key={index} />
              ))}
            </div>
            <div className={styles.panel}>
              <div className={styles.panelHeading}><span className={styles.titleBar} /></div>
              <div className={styles.formGrid}>
                {Array.from({ length: 4 }, (_, index) => (
                  <div className={styles.formField} key={index}>
                    <span className={styles.shortBar} />
                    <span className={styles.inputBar} />
                  </div>
                ))}
              </div>
              <span className={styles.buttonBar} />
            </div>
          </div>
        </>
      ) : (
        <>
          <div className={styles.pageHeading} aria-hidden="true">
            <span className={styles.titleBar} />
            <span className={styles.subtitleBar} />
          </div>
          <div className={styles.featureGrid} aria-hidden="true">
            {Array.from({ length: 3 }, (_, index) => (
              <div className={styles.panel} key={index}>
                <span className={styles.mediumBar} />
                <span className={styles.bodyBar} />
                <span className={styles.bodyBar} />
                <span className={styles.bodyBarShort} />
                <span className={styles.buttonBar} />
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
