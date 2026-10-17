// Input da tastiera MIDI con la Web MIDI API (Chrome, Edge, Firefox; non Safari).
// Ascolta tutti gli ingressi collegati, anche quelli collegati dopo.

export const isMidiSupported = () => typeof navigator !== 'undefined' && !!navigator.requestMIDIAccess;

export async function connectMidi({ onNoteOn, onNoteOff, onDevicesChange }) {
  const access = await navigator.requestMIDIAccess();

  const handleMessage = (e) => {
    const [status, note, velocity] = e.data;
    const command = status & 0xf0;
    if (command === 0x90 && velocity > 0) onNoteOn(note, velocity);
    else if (command === 0x80 || (command === 0x90 && velocity === 0)) onNoteOff(note);
  };

  const bindInputs = () => {
    const names = [];
    for (const input of access.inputs.values()) {
      input.onmidimessage = handleMessage;
      names.push(input.name);
    }
    onDevicesChange(names);
  };

  access.onstatechange = bindInputs;
  bindInputs();
}
