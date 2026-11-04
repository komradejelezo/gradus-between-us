import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { allCards, categories } from "./cards";
import {
  advance,
  applyRoll,
  currentCard,
  defaultSettings,
  diceLabels,
  diceText,
  newGame,
  replaceCard,
  stageOf,
  stages,
  totalEvents,
} from "./engine";
import {
  clearStorage,
  finishHistory,
  readHistory,
  readMemories,
  readSave,
  remember,
  writeSave,
} from "./storage";
import type { Game, Player, Settings } from "./types";
import "./style.css";
const avatars = ["☀", "☾", "✿", "✦", "♡", "♧"];
const colors = ["#E94B80", "#F4C78B", "#b8a5ed", "#86cabb"];
const initialPlayers: [Player, Player] = [
  { name: "", avatar: "☀", color: colors[0] },
  { name: "", avatar: "☾", color: colors[1] },
];
function Options({
  value,
  onChange,
  locked = false,
}: {
  value: Settings;
  onChange: (s: Settings) => void;
  locked?: boolean;
}) {
  const set = <K extends keyof Settings>(key: K, v: Settings[K]) =>
    onChange({ ...value, [key]: v });
  return (
    <div className="options">
      <fieldset disabled={locked}>
        <legend>Время для вас</legend>
        <div className="segments">
          {([15, 30, 45] as const).map((n) => (
            <button
              type="button"
              key={n}
              aria-pressed={value.duration === n}
              onClick={() => set("duration", n)}
            >
              {n} мин
              <span>{n === 15 ? "8" : n === 30 ? "16" : "24"} событий</span>
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset disabled={locked}>
        <legend>Атмосфера</legend>
        <div className="segments">
          {(["Нежная", "Игривая", "Смелая · 18+"] as const).map((label, i) => (
            <button
              type="button"
              key={label}
              aria-pressed={value.level === i + 1}
              onClick={() => set("level", (i + 1) as Settings["level"])}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>
      <label className="toggle">
        <span>
          Задания с прикосновениями
          <small>Всегда только по взаимному согласию</small>
        </span>
        <input
          type="checkbox"
          disabled={locked}
          checked={value.touch}
          onChange={(e) => set("touch", e.target.checked)}
        />
      </label>
      <label className="toggle">
        Сокращённые анимации
        <input
          type="checkbox"
          checked={value.reduced}
          onChange={(e) => set("reduced", e.target.checked)}
        />
      </label>
      <label className="toggle">
        Мягкий звук событий
        <input
          type="checkbox"
          checked={value.sound}
          onChange={(e) => set("sound", e.target.checked)}
        />
      </label>
      {locked && (
        <small>
          Длительность, атмосфера и прикосновения выбираются перед новой
          партией.
        </small>
      )}
    </div>
  );
}
function App() {
  const [game, setGame] = useState<Game | null>(readSave);
  const [screen, setScreen] = useState<"home" | "setup" | "play">("home");
  const [settings, setSettings] = useState<Settings>(
    game?.settings || {
      ...defaultSettings,
      reduced: matchMedia("(prefers-reduced-motion: reduce)").matches,
    },
  );
  const [players, setPlayers] = useState<[Player, Player]>(
    game?.players || initialPlayers,
  );
  const [modal, setModal] = useState<"rules" | "settings" | "pause" | null>(
    null,
  );
  const [adult, setAdult] = useState(false);
  const [notice, setNotice] = useState("");
  const [secret, setSecret] = useState<
    "first" | "handoff" | "second" | "ready" | "revealed"
  >("first");
  const [answers, setAnswers] = useState<[string, string]>(["", ""]);
  const [ready, setReady] = useState<[boolean, boolean]>([false, false]);
  const [choice, setChoice] = useState("");
  const [rolling, setRolling] = useState(false);
  const [savedMemory, setSavedMemory] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audio = useRef<AudioContext | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const card = game ? currentCard(game) : null;
  const reduced =
    game && screen === "play" ? game.settings.reduced : settings.reduced;
  useEffect(() => {
    if (game && !writeSave(game))
      setNotice(
        "Не удалось сохранить прогресс. Не закрывайте эту вкладку: игра доступна до её закрытия.",
      );
  }, [game]);
  useEffect(() => {
    setSecret("first");
    setAnswers(["", ""]);
    setReady([false, false]);
    setChoice("");
    setRolling(false);
    setSavedMemory(false);
    if (timer.current) clearTimeout(timer.current);
  }, [game?.current, screen]);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      void audio.current?.close();
    },
    [],
  );
  useEffect(() => {
    if (modal) dialog.current?.showModal();
    else dialog.current?.close();
  }, [modal]);
  useEffect(() => {
    document.querySelector<HTMLElement>("main h1, main h2")?.focus();
  }, [screen, game?.done]);
  function chime() {
    if (!(game?.settings.sound ?? settings.sound)) return;
    try {
      audio.current ??= new AudioContext();
      void audio.current.resume();
      const osc = audio.current.createOscillator(),
        gain = audio.current.createGain();
      osc.connect(gain);
      gain.connect(audio.current.destination);
      osc.frequency.value = 523.25;
      gain.gain.setValueAtTime(0.045, audio.current.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        audio.current.currentTime + 0.5,
      );
      osc.start();
      osc.stop(audio.current.currentTime + 0.5);
    } catch {
      /* Audio is optional. */
    }
  }
  function next(skip = false) {
    if (!game || rolling) return;
    chime();
    const updated = advance(game, skip, readHistory());
    if (updated.done && !game.done) finishHistory(updated);
    setGame(updated);
  }
  function roll() {
    if (!game || !card || rolling || game.roll) return;
    setRolling(true);
    chime();
    const result = 1 + Math.floor(Math.random() * 6);
    timer.current = setTimeout(
      () => {
        setGame((g) => (g ? applyRoll(g, result) : g));
        setRolling(false);
      },
      reduced ? 0 : 700,
    );
  }
  function leave() {
    setModal(null);
    setScreen("home");
  }
  const progress = game
    ? Math.round((game.completed / totalEvents(game.settings)) * 100)
    : 0;
  return (
    <div className={reduced ? "app reduced" : "app"}>
      <div className="ambient" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
      </div>
      <header>
        <button
          className="wordmark"
          onClick={() =>
            screen === "play" ? setModal("pause") : setScreen("home")
          }
        >
          ГРАДУС<span>МЕЖДУ НАМИ</span>
        </button>
        <span className="edition">ДЛЯ ДВОИХ · 18+</span>
        <button
          className="icon-button"
          aria-label="Настройки"
          onClick={() => setModal("settings")}
        >
          ⚙
        </button>
      </header>
      {notice && (
        <div role="status" className="notice">
          {notice}
          <button onClick={() => setNotice("")} aria-label="Закрыть сообщение">
            ×
          </button>
        </div>
      )}
      {screen === "home" && (
        <main className="home">
          <div className="eyebrow">ВАШ ОСОБЕННЫЙ ВЕЧЕР</div>
          <div className="heart-art" aria-hidden="true">
            <div className="orbit" />
            <div className="orbit two" />
            <span>♡</span>
            <b>✦</b>
            <em>✧</em>
          </div>
          <h1 tabIndex={-1}>
            ГРАДУС<span>Между нами</span>
          </h1>
          <p className="tagline">Сегодня всё только для вас двоих</p>
          <p className="muted intro">
            Оставьте суету за дверью. Впереди — маленькие открытия,
            <br className="desktop" /> тёплые признания и немного приятного
            волнения.
          </p>
          <div className="home-actions">
            {game && !game.done && (
              <button className="primary" onClick={() => setScreen("play")}>
                Продолжить игру <span>→</span>
              </button>
            )}
            <button
              className={game && !game.done ? "secondary" : "primary"}
              onClick={() => setScreen("setup")}
            >
              Начать игру <span>→</span>
            </button>
            <button className="text-button" onClick={() => setModal("rules")}>
              Как провести этот вечер <span>→</span>
            </button>
          </div>
          <div className="features">
            <span>✧ 5 этапов сближения</span>
            <span>◈ 90 карточек</span>
            <span>♡ Без победителей</span>
          </div>
          {readMemories().length > 0 && (
            <section className="memories">
              <h2>Ваши памятные вечера</h2>
              {readMemories()
                .slice(-3)
                .reverse()
                .map((m) => (
                  <p key={m.date}>
                    {new Date(m.date).toLocaleDateString("ru-RU")} · {m.events}{" "}
                    событий · вместе до финала
                  </p>
                ))}
            </section>
          )}
          <p className="privacy">
            Только вы двое. Без регистрации. Всё остаётся на этом устройстве.
          </p>
        </main>
      )}
      {screen === "setup" && (
        <main className="setup">
          <button className="text-button" onClick={() => setScreen("home")}>
            ← В меню
          </button>
          <div className="eyebrow">ПЕРЕД ТЕМ КАК ЗАЖЕЧЬ ИСКРУ</div>
          <h1 tabIndex={-1}>Познакомимся поближе</h1>
          <p className="muted">Два человека. Один вечер. Ваши правила.</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!adult) return;
              setGame(
                newGame(
                  players.map((p) => ({ ...p, name: p.name.trim() })) as [
                    Player,
                    Player,
                  ],
                  settings,
                ),
              );
              setScreen("play");
            }}
          >
            <div className="player-forms">
              {players.map((p, i) => (
                <section className="glass player-form" key={i}>
                  <span className="eyebrow">ИГРОК {i + 1}</span>
                  <label>
                    Имя
                    <input
                      required
                      maxLength={32}
                      value={p.name}
                      placeholder={i ? "Например, Саша" : "Например, Женя"}
                      onChange={(e) =>
                        setPlayers(
                          players.map((v, k) =>
                            k === i ? { ...v, name: e.target.value } : v,
                          ) as [Player, Player],
                        )
                      }
                      pattern=".*\S.*"
                    />
                  </label>
                  <fieldset>
                    <legend>Ваш символ</legend>
                    <div className="avatar-picker">
                      {avatars.map((a) => (
                        <button
                          type="button"
                          aria-label={`Игрок ${i + 1}: аватар ${a}`}
                          key={a}
                          aria-pressed={p.avatar === a}
                          onClick={() =>
                            setPlayers(
                              players.map((v, k) =>
                                k === i ? { ...v, avatar: a } : v,
                              ) as [Player, Player],
                            )
                          }
                        >
                          {a}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                  <fieldset>
                    <legend>Ваш цвет</legend>
                    <div className="color-picker">
                      {colors.map((c) => (
                        <button
                          type="button"
                          style={{ background: c }}
                          key={c}
                          aria-label={`Игрок ${i + 1}: цвет ${c}`}
                          aria-pressed={p.color === c}
                          onClick={() =>
                            setPlayers(
                              players.map((v, k) =>
                                k === i ? { ...v, color: c } : v,
                              ) as [Player, Player],
                            )
                          }
                        />
                      ))}
                    </div>
                  </fieldset>
                </section>
              ))}
            </div>
            <section className="glass setup-options">
              <Options value={settings} onChange={setSettings} />
              <label className="consent">
                <input
                  required
                  type="checkbox"
                  checked={adult}
                  onChange={(e) => setAdult(e.target.checked)}
                />
                Нам обоим исполнилось 18 лет. Мы играем добровольно и можем
                пропустить любое задание.
              </label>
              {game && !game.done && (
                <p className="muted">
                  Начало новой партии заменит текущее сохранение.
                </p>
              )}
              <button className="primary wide" type="submit">
                Зажечь искру <span>✦</span>
              </button>
            </section>
          </form>
        </main>
      )}
      {screen === "play" && game && card && (
        <main className="play">
          <div className="play-top">
            <div>
              <div className="eyebrow">ВАШ ВЕЧЕР</div>
              <h1 tabIndex={-1}>
                {game.done ? "Вы стали ещё ближе" : stages[stageOf(game) - 1]}
              </h1>
            </div>
            <button className="secondary" onClick={() => setModal("pause")}>
              || Пауза
            </button>
          </div>
          <div
            className="stage-track"
            aria-label={`Этап ${stageOf(game)} из 5`}
          >
            {stages.map((s, i) => (
              <span key={s} className={stageOf(game) >= i + 1 ? "lit" : ""}>
                <b>{i + 1}</b>
                <span>{s}</span>
              </span>
            ))}
          </div>
          <div className="players">
            {game.players.map((p, i) => (
              <div
                className={i === game.turn ? "player active" : "player"}
                key={i}
              >
                <span
                  className="avatar"
                  style={{ color: p.color, borderColor: p.color }}
                >
                  {p.avatar}
                </span>
                <div>
                  <span>{p.name}</span>
                  <small>{i === game.turn ? "Ваш ход" : "Рядом с вами"}</small>
                </div>
              </div>
            ))}
          </div>
          <div className="meter-label">
            <span>
              {stageOf(game) === 5
                ? "Ваш градус близости"
                : `Событие ${game.completed + 1} из ${totalEvents(game.settings)}`}
            </span>
            <span>{progress}° / 100°</span>
          </div>
          <div
            className="meter"
            role="progressbar"
            aria-label="Градус близости"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div style={{ width: `${progress}%` }} />
          </div>
          {game.done ? (
            <section className="glass result">
              <div className="result-heart" aria-hidden="true">
                ♥
              </div>
              <div className="eyebrow">ВАША ИСТОРИЯ ПРОДОЛЖАЕТСЯ</div>
              <h2 tabIndex={-1}>Между вами — целый мир</h2>
              <p>Спасибо, что подарили это время друг другу.</p>
              <div className="stats">
                <div>
                  <strong>{game.completed}</strong>событий
                </div>
                <div>
                  <strong>5</strong>этапов
                </div>
                <div>
                  <strong>{game.skipped}</strong>пропусков без штрафа
                </div>
              </div>
              <p className="muted">Ваши ответы и признания не сохраняются.</p>
              <button
                className="secondary"
                disabled={savedMemory}
                onClick={() => {
                  if (remember(game)) setSavedMemory(true);
                  else
                    setNotice(
                      "Не удалось сохранить памятный результат: хранилище недоступно.",
                    );
                }}
              >
                {savedMemory
                  ? "♡ Результат сохранён"
                  : "♡ Сохранить памятный результат"}
              </button>
              <div className="button-row">
                <button className="primary" onClick={() => setScreen("setup")}>
                  Ещё один вечер
                </button>
                <button className="text-button" onClick={leave}>
                  В меню
                </button>
              </div>
            </section>
          ) : (
            <>
              {game.effects.length > 0 && (
                <aside className="effects" aria-label="Активные эффекты">
                  {game.effects.map((e) => (
                    <p key={e.id}>
                      ✦ {e.text}
                      <small>
                        Осталось событий: {e.until - game.completed}
                      </small>
                    </p>
                  ))}
                </aside>
              )}
              <section
                key={card.id}
                className={`game-card glass ${card.category === "final" ? "final-card" : ""}`}
              >
                <div className="card-top">
                  <span>
                    {categories[card.category].icon}{" "}
                    {categories[card.category].name}
                  </span>
                  <span>
                    {card.level === 1
                      ? "НЕЖНО"
                      : card.level === 2
                        ? "ИГРИВО"
                        : "СМЕЛО"}
                  </span>
                </div>
                <div className="card-symbol" aria-hidden="true">
                  {categories[card.category].icon}
                </div>
                <p className="eyebrow">{categories[card.category].hint}</p>
                <h2>{card.title}</h2>
                <p className="card-text">{card.text}</p>
                {card.touch && (
                  <p className="touch-note">
                    ♡ Прикосновения только с согласия вас обоих.
                  </p>
                )}
                {card.interaction === "secret" && (
                  <div className="secret" aria-live="polite">
                    {(secret === "first" || secret === "second") && (
                      <>
                        <p>
                          Отвечает{" "}
                          {
                            game.players[
                              secret === "first" ? game.turn : 1 - game.turn
                            ].name
                          }
                          . Партнёр, пожалуйста, отвернитесь.
                        </p>
                        <div className="answer-grid">
                          {card.options.map((o) => (
                            <button
                              key={o}
                              onClick={() => {
                                if (secret === "first") {
                                  setAnswers((a) =>
                                    game.turn === 0 ? [o, a[1]] : [a[0], o],
                                  );
                                  setSecret("handoff");
                                } else {
                                  setAnswers((a) =>
                                    game.turn === 0 ? [a[0], o] : [o, a[1]],
                                  );
                                  setSecret("ready");
                                }
                              }}
                            >
                              {o}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                    {secret === "handoff" && (
                      <div className="handoff">
                        <span aria-hidden="true">⇄</span>
                        <h3>Передай устройство партнёру</h3>
                        <p>Первый ответ скрыт. Теперь ваша очередь выбирать.</p>
                        <button
                          className="primary"
                          onClick={() => setSecret("second")}
                        >
                          Устройство у меня
                        </button>
                      </div>
                    )}
                    {secret === "ready" && (
                      <>
                        <p>Оба ответа скрыты. Подтвердите готовность вместе.</p>
                        <div className="button-row">
                          {game.players.map((p, i) => (
                            <button
                              key={i}
                              aria-pressed={ready[i]}
                              onClick={() =>
                                setReady((r) =>
                                  i === 0 ? [true, r[1]] : [r[0], true],
                                )
                              }
                            >
                              {p.name}: {ready[i] ? "готово ✓" : "я готов(а)"}
                            </button>
                          ))}
                        </div>
                        <button
                          className="primary"
                          disabled={!ready.every(Boolean)}
                          onClick={() => {
                            chime();
                            setSecret("revealed");
                          }}
                        >
                          Раскрыть ответы
                        </button>
                      </>
                    )}
                    {secret === "revealed" && (
                      <div
                        className={
                          answers[0] === answers[1] ? "reveal match" : "reveal"
                        }
                      >
                        <h3>
                          {answers[0] === answers[1]
                            ? "♥ Вы на одной волне!"
                            : "✧ Два взгляда — больше открытий"}
                        </h3>
                        {game.players.map((p, i) => (
                          <p key={i}>
                            <strong>{p.name}</strong>
                            <span>{answers[i]}</span>
                          </p>
                        ))}
                        <small>
                          {answers[0] === answers[1]
                            ? "Как приятно совпасть."
                            : "Расскажите, что стоит за вашим выбором."}
                        </small>
                      </div>
                    )}
                  </div>
                )}
                {card.interaction === "choice" && (
                  <div className="answer-grid">
                    {card.options.map((o) => (
                      <button
                        key={o}
                        aria-pressed={choice === o}
                        onClick={() => setChoice(o)}
                      >
                        {o}
                      </button>
                    ))}
                  </div>
                )}
                {card.dice && (
                  <div className="dice-panel">
                    <button
                      className="dice-button"
                      onClick={roll}
                      disabled={rolling || game.roll !== null}
                      aria-label="Бросить кубик"
                    >
                      <span className={rolling ? "die rolling" : "die"}>
                        {game.roll
                          ? ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"][game.roll - 1]
                          : "⚄"}
                      </span>
                      <span>
                        {rolling
                          ? "Судьба выбирает…"
                          : game.roll
                            ? diceLabels[game.roll - 1]
                            : "Бросить кубик судьбы"}
                      </span>
                    </button>
                    {game.roll && (
                      <div className="dice-result">
                        {game.bonus ? (
                          <>
                            <strong>
                              ✦{" "}
                              {allCards.find((c) => c.id === game.bonus)?.title}
                            </strong>
                            <p>
                              {allCards.find((c) => c.id === game.bonus)?.text}
                            </p>
                          </>
                        ) : (
                          diceText[game.roll - 1]
                        )}
                      </div>
                    )}
                  </div>
                )}
                <p className="completion">{card.completion}</p>
                <button
                  className="primary wide"
                  disabled={
                    rolling ||
                    (card.dice && !game.roll) ||
                    (card.interaction === "secret" && secret !== "revealed") ||
                    (card.interaction === "choice" && !choice)
                  }
                  onClick={() => next()}
                >
                  {card.category === "final"
                    ? "Завершить наш вечер"
                    : card.interaction === "choice"
                      ? "Мы оба согласны · Выполнено"
                      : "Мы выполнили"}{" "}
                  <span>♡</span>
                </button>
              </section>
              <div className="card-actions">
                {card.category !== "final" && (
                  <button
                    className="text-button"
                    disabled={rolling}
                    onClick={() => {
                      const replacement = replaceCard(game);
                      if (replacement === game)
                        setNotice(
                          "Карточки на этом этапе зарезервированы для следующих событий. Можно пропустить событие и продолжить.",
                        );
                      else setGame(replacement);
                    }}
                  >
                    ↻ Сменить карточку
                  </button>
                )}
                <button
                  className="text-button"
                  disabled={rolling}
                  onClick={() => next(true)}
                >
                  {card.category === "final"
                    ? "Завершить без задания"
                    : "Пропустить без объяснений"}{" "}
                  →
                </button>
              </div>
              <p className="privacy">
                Здесь нет правильных ответов. Только то, что комфортно вам
                обоим.
              </p>
            </>
          )}
        </main>
      )}
      <footer>
        <span>МАЛЕНЬКИЕ МОМЕНТЫ. БОЛЬШАЯ БЛИЗОСТЬ.</span>
        <span>v0.1 · С любовью к вашему «мы»</span>
      </footer>
      <dialog
        ref={dialog}
        onCancel={() => setModal(null)}
        onClick={(e) => {
          if (e.target === dialog.current) setModal(null);
        }}
      >
        <div className="dialog-inner">
          <button
            className="close"
            aria-label="Закрыть"
            onClick={() => setModal(null)}
          >
            ×
          </button>
          <h2>
            {modal === "rules"
              ? "Ваш вечер, ваши правила"
              : modal === "pause"
                ? "Можно никуда не спешить"
                : "Настройки"}
          </h2>
          {modal === "rules" ? (
            <div className="rules">
              <p>
                Вам обоим должно быть 18 лет. Играйте добровольно: любые
                прикосновения — только с взаимного согласия.
              </p>
              <p>
                Вы проходите четыре этапа: «Искра», «Притяжение», «Химия»,
                «Жар», затем открываете финал «Между нами». На этап приходится
                2, 4 или 6 событий в зависимости от выбранной длительности.
              </p>
              <p>
                Чередуйте ходы, выполняйте карточки, выбирайте вместе и бросайте
                кубик на отмеченных карточках. Его эффект действует на текущий
                ход. Карты-сюрпризы создают эффекты с указанным сроком.
              </p>
              <p>
                Для тайных ответов один выбирает, затем передаёт устройство
                другому. После двух ответов оба подтверждают готовность. Ответы
                не сохраняются; после перезагрузки вопрос нужно пройти заново.
              </p>
              <p>
                Пропуск засчитывает событие без штрафа. Замена предлагает новую
                карточку без продвижения. Таймера нет: длительность — лишь
                ориентир темпа.
              </p>
              <p>
                Прогресс хранится только в этом браузере. Победителей нет — вы
                вместе.
              </p>
            </div>
          ) : (
            <>
              <Options
                value={screen === "play" && game ? game.settings : settings}
                locked={screen === "play"}
                onChange={(s) => {
                  setSettings(s);
                  if (screen === "play" && game)
                    setGame({ ...game, settings: s });
                }}
              />
              {modal === "pause" && (
                <>
                  <button
                    className="primary wide"
                    onClick={() => setModal(null)}
                  >
                    Продолжить вечер
                  </button>
                  <button className="text-button" onClick={leave}>
                    Сохранить и выйти в меню
                  </button>
                </>
              )}
              <button
                className="danger"
                onClick={() => {
                  if (
                    confirm(
                      "Удалить прогресс, имена и все памятные результаты с этого устройства?",
                    )
                  ) {
                    if (clearStorage()) {
                      setGame(null);
                      setPlayers(initialPlayers);
                      setSettings(defaultSettings);
                      setAdult(false);
                      setModal(null);
                      setScreen("home");
                      setNotice("Все сохранённые данные игры удалены.");
                    } else
                      setNotice(
                        "Браузер не разрешил удалить данные. Проверьте настройки хранилища.",
                      );
                  }
                }}
              >
                Удалить все данные игры
              </button>
            </>
          )}
        </div>
      </dialog>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
