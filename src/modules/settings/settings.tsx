"use client";
import { BookOpen, Clock, CheckCheck } from "lucide-react";
import { useLibrary } from "@/modules/library/store";
import { readingDate } from "@/modules/library/reading-calendar";
export { SettingsView } from "./settings-view";
export function StatisticsView() {
  const { documents, annotations, readingSeconds, readingDays, preferences } =
    useLibrary();
  const finished = documents.filter((d) => d.status === "finished" && !d.demo);
  const minutes = Math.floor(readingSeconds / 60);
  const percent = Math.min(
    100,
    Math.round(
      ((readingDays?.[readingDate()] ?? 0) / 60 / preferences.dailyGoal) * 100,
    ),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Uma página de cada vez</h1>
          <p>O tempo dedicado à leitura também conta uma história.</p>
        </div>
      </div>
      <section className="reading-stats">
        <div className="reading-time">
          <BookOpen size={36} strokeWidth={1.2} />
          <h2>Seu tempo entre páginas</h2>
          <strong>
            {minutes}
            <small>minutos</small>
          </strong>
          <p>de leitura registrada neste navegador</p>
          <div className="goal-progress">
            <span style={{ width: `${percent}%` }} />
          </div>
          <span>
            {percent}% da meta de hoje de {preferences.dailyGoal} minutos
          </span>
        </div>
        <div className="statistics-details">
          <div>
            <CheckCheck size={21} />
            <strong>{finished.length}</strong>
            <span>Documentos concluídos</span>
          </div>
          <div>
            <BookOpen size={21} />
            <strong>
              {documents.filter((d) => d.status === "reading").length}
            </strong>
            <span>Leituras em andamento</span>
          </div>
          <div>
            <Clock size={21} />
            <strong>{annotations.length}</strong>
            <span>Ideias e marcações guardadas</span>
          </div>
        </div>
      </section>
      <section aria-label="Histórico diário">
        <h2>Últimos sete dias</h2>
        <table>
          <thead>
            <tr>
              <th>Dia</th>
              <th>Minutos</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 7 }, (_, i) => {
              const day = new Date();
              day.setDate(day.getDate() - i);
              const key = readingDate(day);
              return (
                <tr key={key}>
                  <td>{day.toLocaleDateString("pt-BR")}</td>
                  <td>{Math.floor((readingDays?.[key] ?? 0) / 60)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
      <p className="stats-footnote">
        O tempo é contado enquanto o leitor está aberto e a aba está visível.
        Amostras não entram na contagem de documentos concluídos.
      </p>
    </>
  );
}
