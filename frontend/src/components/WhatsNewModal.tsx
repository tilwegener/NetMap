import { ExternalLink } from "lucide-react";
import { type ChangelogRelease, type VersionInfo } from "../api/client";
import { Modal } from "./Modal";

export const whatsNewAcknowledgedKey = "netmap.whatsNew.acknowledgedVersion";

export function shouldShowWhatsNew(versionInfo: VersionInfo | null) {
  if (!versionInfo?.current) return false;
  const acknowledged = window.localStorage.getItem(whatsNewAcknowledgedKey);
  if (!acknowledged) return true;
  return acknowledged !== versionInfo.current;
}

export function dismissWhatsNew(version: string) {
  window.localStorage.setItem(whatsNewAcknowledgedKey, version);
}

function ChangelogItem({ text }: { text: string }) {
  const match = text.match(/^\*\*(.+?)\*\*(?:\s[—-]\s(.*))?$/s);
  if (match) {
    return (
      <li>
        <strong>{match[1]}</strong>
        {match[2] ? <> — {match[2]}</> : null}
      </li>
    );
  }
  return <li>{text.replace(/\*\*(.+?)\*\*/g, "$1")}</li>;
}

function ChangelogReleaseBlock({ release }: { release: ChangelogRelease }) {
  return (
    <section className="whats-new-release">
      {release.sections.map((section) => (
        <div className="whats-new-section" key={`${release.version}-${section.category}`}>
          <h4 className="whats-new-section-title">{section.category}</h4>
          <ul className="whats-new-list">
            {section.items.map((item) => (
              <ChangelogItem key={item} text={item} />
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

export function WhatsNewModal({
  onClose,
  versionInfo,
}: {
  onClose: () => void;
  versionInfo: VersionInfo;
}) {
  const releases = versionInfo.whats_new ?? [];
  const hasHighlights = releases.some((release) => release.sections.length > 0);
  const releaseUrl = versionInfo.current_release_url
    ?? `https://github.com/xoriin/netmap/releases/tag/v${versionInfo.current}`;
  return (
    <Modal
      title={`What's new in v${versionInfo.current}`}
      onCancel={onClose}
      size={hasHighlights ? "md" : "sm"}
      footer={(
        <>
          <button type="button" className="nm-btn" onClick={onClose}>
            Got it
          </button>
          <a className="nm-btn nm-btn--primary" href={releaseUrl} target="_blank" rel="noreferrer">
            <ExternalLink size={14} aria-hidden="true" />
            Release notes
          </a>
        </>
      )}
    >
      <div className="modal-body whats-new-modal-body">
        <div className="whats-new-version-card">
          <span>Installed version</span>
          <strong>{versionInfo.channel ? `${versionInfo.channel}: ` : "v"}{versionInfo.current}</strong>
        </div>
        {hasHighlights ? (
          <div className="whats-new-highlights">
            {releases.map((release) => (
              <ChangelogReleaseBlock key={release.version} release={release} />
            ))}
          </div>
        ) : (
          <p>Review the release notes for details about this version.</p>
        )}
      </div>
    </Modal>
  );
}
