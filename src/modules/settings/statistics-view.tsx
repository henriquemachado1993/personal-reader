"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/controls";
import { useLibrary } from "@/modules/library/store";
import { formatReadingTime, readingActivity } from "./reading-statistics";
import "./workspace-page.css";
import "./statistics-view.css";

export function StatisticsView() {
  const { documents, annotations, readingSeconds, readingDays, preferences } =
    useLibrary();
  const [periodLength, setPeriodLength] = useState(7);
  const activity = readingActivity(
    readingDays,
    periodLength,
    preferences.dailyGoal,
  );
  const week = activity.days;
  const resume = documents
    .filter((document) => document.status === "reading" && !document.demo)
    .sort((a, b) => (b.lastReadAt ?? "").localeCompare(a.lastReadAt ?? ""))[0];
  const change =
    activity.previousSeconds > 0
      ? Math.round(
          ((activity.totalSeconds - activity.previousSeconds) /
            activity.previousSeconds) *
            100,
        )
      : null;
  const comparison =
    change === null
      ? `Sem leitura nos ${periodLength} dias anteriores.`
      : activity.totalSeconds === activity.previousSeconds
        ? "Mesmo tempo de leitura do período anterior."
        : change === 0
          ? "Variação menor que 1% em relação ao período anterior."
          : `${Math.abs(change)}% ${change > 0 ? "a mais" : "a menos"} que nos ${periodLength} dias anteriores.`;
  const todaySeconds = week[0].seconds;
  const goalSeconds = Math.max(1, preferences.dailyGoal) * 60;
  const percent = Math.min(100, Math.floor((todaySeconds / goalSeconds) * 100));
  const weeklySeconds = week.reduce((sum, day) => sum + day.seconds, 0);
  const largestDay = Math.max(...week.map((day) => day.seconds), 1);
  const summary = [
    {
      label: "Tempo total de leitura",
      value: formatReadingTime(readingSeconds),
    },
    {
      label: "Documentos concluídos",
      value: documents.filter(
        (document) => document.status === "finished" && !document.demo,
      ).length,
    },
    {
      label: "Leituras em andamento",
      value: documents.filter((document) => document.status === "reading")
        .length,
    },
    { label: "Ideias e marcações guardadas", value: annotations.length },
  ];
  return (
    <div className="workspace-page statistics-page">
      <div className="page-heading">
        <div>
          <h1>Estatísticas</h1>
          <p>O tempo dedicado à leitura também conta uma história.</p>
        </div>
        <div
          className="statistics-period-switch"
          role="group"
          aria-label="Período das estatísticas"
        >
          {[7, 30].map((length) => (
            <Button
              key={length}
              aria-pressed={periodLength === length}
              onClick={() => setPeriodLength(length)}
            >
              {length} dias
            </Button>
          ))}
        </div>
      </div>
      <section
        className="statistics-today"
        aria-labelledby="statistics-today-title"
      >
        <div>
          <h2 id="statistics-today-title">Sua meta de hoje</h2>
          <p>
            <strong>{formatReadingTime(todaySeconds)}</strong> de{" "}
            {preferences.dailyGoal} minutos
          </p>
          {todaySeconds < goalSeconds && (
            <p className="statistics-remaining">
              Para completar a meta:{" "}
              {formatReadingTime(goalSeconds - todaySeconds)}.
            </p>
          )}
          {resume && (
            <Link
              className="button secondary statistics-resume"
              href={`/reader/${encodeURIComponent(resume.id)}`}
            >
              Retomar {resume.title}
            </Link>
          )}
        </div>
        <div className="statistics-goal">
          <span>
            {percent === 100 ? "Meta atingida" : `${percent}% da meta diária`}
          </span>
          <progress
            aria-label="Progresso da meta diária"
            aria-valuetext={`${formatReadingTime(todaySeconds)} de ${preferences.dailyGoal} minutos`}
            value={Math.min(todaySeconds, goalSeconds)}
            max={goalSeconds}
          />
          <Link href="/settings">Ajustar meta diária</Link>
        </div>
      </section>
      <section
        className="statistics-rhythm"
        aria-labelledby="statistics-rhythm-title"
      >
        <h2 id="statistics-rhythm-title">Seu ritmo</h2>
        <dl className="statistics-habits">
          <div>
            <dt>Dias com leitura</dt>
            <dd>
              {activity.activeDays} de {periodLength}
            </dd>
          </div>
          <div>
            <dt>Média por dia</dt>
            <dd>{formatReadingTime(activity.averageSeconds)}</dd>
          </div>
          <div>
            <dt>Dias com a meta atual</dt>
            <dd>
              {activity.goalDays} de {periodLength}
            </dd>
          </div>
          <div>
            <dt>Sequência atual</dt>
            <dd>
              {activity.streak} {activity.streak === 1 ? "dia" : "dias"}
            </dd>
            <span className="statistics-record">
              Recorde: {activity.bestStreak}{" "}
              {activity.bestStreak === 1 ? "dia" : "dias"}
            </span>
          </div>
        </dl>
        <details className="statistics-method">
          <summary>Como calculamos</summary>
          <p>
            A média inclui dias sem leitura. A sequência segue até hoje ou
            ontem; o recorde considera todo o histórico registrado. Dias
            anteriores são avaliados com a meta atual.
          </p>
        </details>
      </section>
      <section
        className="statistics-history"
        aria-labelledby="statistics-week-title"
      >
        <div className="statistics-section-heading">
          <h2 id="statistics-week-title">
            {periodLength === 7 ? "Últimos sete dias" : "Últimos 30 dias"}
          </h2>
          <span>{formatReadingTime(weeklySeconds)} no período</span>
        </div>
        <p className="statistics-comparison">
          Período anterior: {formatReadingTime(activity.previousSeconds)}.{" "}
          {comparison}
        </p>
        {weeklySeconds === 0 ? (
          <div className="statistics-empty">
            <p>
              Nenhuma leitura registrada nos últimos{" "}
              {periodLength === 7 ? "sete" : "30"} dias.
            </p>
            <Link className="button secondary" href="/library">
              Escolher uma leitura
            </Link>
          </div>
        ) : (
          <div
            className={`statistics-history-scroll ${periodLength === 30 ? "is-month" : ""}`}
            tabIndex={periodLength === 30 ? 0 : undefined}
            role="region"
            aria-label="Histórico de leitura"
          >
            <table>
              <caption className="sr-only">
                Tempo de leitura registrado nos últimos {periodLength} dias
              </caption>
              <thead>
                <tr>
                  <th scope="col">Dia</th>
                  <th scope="col">Tempo de leitura</th>
                </tr>
              </thead>
              <tbody>
                {week.map((day, index) => (
                  <tr key={day.key}>
                    <th scope="row">
                      <time dateTime={day.key}>
                        {index === 0
                          ? "Hoje"
                          : day.date.toLocaleDateString("pt-BR", {
                              weekday: "short",
                            })}
                        <span>
                          {day.date.toLocaleDateString("pt-BR", {
                            day: "2-digit",
                            month: "short",
                          })}
                        </span>
                      </time>
                    </th>
                    <td>
                      <div className="statistics-day">
                        <div
                          className="statistics-day-track"
                          aria-hidden="true"
                        >
                          <span
                            style={{
                              width: `${(day.seconds / largestDay) * 100}%`,
                            }}
                          />
                        </div>
                        <span className="statistics-day-value">
                          {formatReadingTime(day.seconds)}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section
        className="statistics-library"
        aria-labelledby="statistics-library-title"
      >
        <h2 id="statistics-library-title">Sua biblioteca</h2>
        <dl className="statistics-summary" aria-label="Resumo da biblioteca">
          {summary.map((item) => (
            <div key={item.label}>
              <dt>{item.label}</dt>
              <dd>{item.value}</dd>
            </div>
          ))}
        </dl>
      </section>
      <p className="statistics-footnote">
        O tempo é contado enquanto o leitor está aberto e a aba está visível.
        Amostras não entram na contagem de documentos concluídos.
      </p>
    </div>
  );
}
