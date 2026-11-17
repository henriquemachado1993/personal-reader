"use client";

import { useState } from "react";
import { Modal } from "@/components/ui";
import { Button } from "@/components/ui/controls";
import { appVersion, releaseNotes } from "@/shared/app-release";
import "./release-notes.css";

const releaseDate = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "long",
  timeZone: "UTC",
});

export function AppVersion() {
  const [opened, setOpened] = useState(false);
  return (
    <>
      <div className="settings-version">
        <p>
          Le-Books <span>Versão {appVersion}</span>
        </p>
        <Button
          type="button"
          className="button secondary"
          onClick={() => setOpened(true)}
        >
          Ver novidades
        </Button>
      </div>
      <Modal
        opened={opened}
        title="O que há de novo"
        onClose={() => setOpened(false)}
      >
        <div className="release-notes">
          {releaseNotes.map((release) => (
            <article
              className="release-note"
              key={release.version}
              aria-label={`Versão ${release.version}`}
            >
              <div className="release-note-heading">
                <h3>Versão {release.version}</h3>
                {release.version === appVersion && (
                  <span className="release-current">Atual</span>
                )}
              </div>
              <time dateTime={release.date}>
                {releaseDate.format(new Date(`${release.date}T12:00:00Z`))}
              </time>
              <p className="release-note-title">{release.title}</p>
              {release.sections.map((section) => (
                <section key={section.title}>
                  <h4>{section.title}</h4>
                  <ul>
                    {section.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </section>
              ))}
            </article>
          ))}
        </div>
        <div className="dialog-actions">
          <Button
            type="button"
            className="button primary"
            onClick={() => setOpened(false)}
          >
            Concluir
          </Button>
        </div>
      </Modal>
    </>
  );
}
