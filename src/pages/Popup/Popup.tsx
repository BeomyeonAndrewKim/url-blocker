import React, { useEffect, useState } from 'react';
import {
  BLOCKLIST_KEY,
  getBlocklist,
  setBlocklist,
} from '../../shared/storage';

function normalize(input: string): string {
  let s = input.trim().toLowerCase();
  s = s.replace(/^https?:\/\//, '');
  s = s.replace(/^www\./, '');
  s = s.split('/')[0];
  return s;
}

const Popup = () => {
  const [domains, setDomains] = useState<string[]>([]);
  const [input, setInput] = useState('');

  useEffect(() => {
    getBlocklist().then(setDomains);
    const listener = (
      changes: { [key: string]: chrome.storage.StorageChange },
      area: chrome.storage.AreaName
    ) => {
      if (area === 'local' && changes[BLOCKLIST_KEY]) {
        setDomains(changes[BLOCKLIST_KEY].newValue ?? []);
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const domain = normalize(input);
    if (!domain || domains.includes(domain)) {
      setInput('');
      return;
    }
    await setBlocklist([...domains, domain]);
    setInput('');
  };

  const remove = async (domain: string) => {
    await setBlocklist(domains.filter((d) => d !== domain));
  };

  return (
    <div style={{ width: 280, padding: 12, fontFamily: 'system-ui' }}>
      <h3 style={{ margin: '0 0 8px' }}>Blocked sites</h3>
      <form onSubmit={add} style={{ display: 'flex', gap: 4 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="example.com"
          style={{ flex: 1, padding: 4 }}
        />
        <button type="submit">Add</button>
      </form>
      <ul style={{ listStyle: 'none', padding: 0, marginTop: 12 }}>
        {domains.map((d) => (
          <li
            key={d}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '4px 0',
            }}
          >
            <span>{d}</span>
            <button onClick={() => remove(d)}>×</button>
          </li>
        ))}
        {domains.length === 0 && (
          <li style={{ color: '#888' }}>No domains blocked yet.</li>
        )}
      </ul>
    </div>
  );
};

export default Popup;
