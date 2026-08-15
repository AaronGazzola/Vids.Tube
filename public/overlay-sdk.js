// Vids.Tube overlay SDK, version 1.
//
// THE PROTOCOL IS THE CONTRACT. THIS FILE IS A CONVENIENCE.
//
// You may load this from the host, or copy it into your own project and never
// speak to us again. Nothing here is privileged, and an overlay that implements
// the protocol by hand is exactly as capable as one that uses this. It is written
// as a plain ES module with no build step so that anyone who has to trust it can
// read the whole thing in one sitting.
//
// The specification lives in the host's openspec/specs/overlay-message-channel.
//
// The protocol, in full:
//
//   Every message carries { ns: "vidstube-overlay", v: 1 }. Check both before
//   anything else: your page receives every frame's messages on one listener.
//   `ns` and not `channel`, because on this platform a channel is a streamer's
//   channel and nothing else.
//
//   You send, once, when your code is ready:
//     { ns: "vidstube-overlay", v: 1, type: "ready" }
//
//   The host answers:
//     { ..., type: "hello", channel: <channel id>, settings: {...}, box: {...} }
//
//   The host then sends, whenever they change:
//     { ..., type: "settings", settings: {...} }
//     { ..., type: "box", box: { width, height, scale } }
//
//   And, for each chat command run for you:
//     { ..., type: "event", event: { id, keyword, args, at, actor, actorName } }
//
//   `actor` is opaque and is yours alone: the same person is a different actor in
//   another overlay, and on another channel. Key a player to it. `actorName` is
//   for the on-screen moment and is neither stable nor unique — never key to it.
//
// Everything the host holds is in `hello`, so you are never assembling state from
// updates you may have joined halfway through.

const NS = "vidstube-overlay";
const VERSION = 1;

function parse(data) {
  if (typeof data !== "object" || data === null || Array.isArray(data)) return null;
  if (data.ns !== NS) return null;
  if (data.v !== VERSION) return null;
  if (typeof data.type !== "string") return null;
  return data;
}

export function connectOverlay() {
  const listeners = { settings: [], box: [], hello: [], event: [] };
  const state = { channel: null, settings: {}, box: null };
  let answered = false;

  const emit = (name, value) => {
    for (const listener of listeners[name]) {
      try {
        listener(value);
      } catch (error) {
        console.error("overlay sdk: a listener threw", error);
      }
    }
  };

  window.addEventListener("message", (event) => {
    // Only the page that framed us. We deliberately do not check the origin
    // here: an overlay may be framed by any host that speaks this protocol, and
    // the parent is the only window that can be one.
    if (event.source !== window.parent) return;

    const message = parse(event.data);
    if (!message) return;

    if (message.type === "hello") {
      answered = true;
      state.channel = message.channel;
      state.settings = message.settings || {};
      state.box = message.box || null;
      emit("hello", { ...state });
      emit("settings", state.settings);
      if (state.box) emit("box", state.box);
      return;
    }
    if (message.type === "settings") {
      state.settings = message.settings || {};
      emit("settings", state.settings);
      return;
    }
    if (message.type === "box") {
      state.box = message.box || null;
      if (state.box) emit("box", state.box);
      return;
    }
    // Not held in state and never replayed: an event is a thing that happened,
    // and a listener attached later has genuinely missed it.
    if (message.type === "event") {
      if (message.event) emit("event", message.event);
    }
  });

  // A wildcard target, and it has to be: an overlay does not know its host's
  // origin, and once overlays are proxied it will be told even less about it.
  // This message carries nothing worth protecting — it says only "I exist".
  //
  // Repeated until answered, because announcing once is a race the overlay always
  // loses: a host attaches its listener when its own state is ready, and an
  // announcement landing a moment earlier is heard by nobody and never repeated.
  // The frame is then silent for the rest of the stream, and the only symptom is
  // that chat appears to do nothing.
  const announce = () =>
    window.parent.postMessage({ ns: NS, v: VERSION, type: "ready" }, "*");
  announce();
  const retry = setInterval(() => {
    if (answered) clearInterval(retry);
    else announce();
  }, 500);

  return {
    // The channel this overlay is serving, once the host has said. Null before
    // that, which is a real state: bind an account to it, do not assume it.
    get channel() {
      return state.channel;
    },
    get settings() {
      return state.settings;
    },
    get box() {
      return state.box;
    },
    onHello(listener) {
      listeners.hello.push(listener);
      if (state.channel !== null) listener({ ...state });
    },
    onSettings(listener) {
      listeners.settings.push(listener);
      if (state.channel !== null) listener(state.settings);
    },
    onBox(listener) {
      listeners.box.push(listener);
      if (state.box) listener(state.box);
    },
    onEvent(listener) {
      listeners.event.push(listener);
    },
  };
}
