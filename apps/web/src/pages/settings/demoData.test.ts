import { clearDemoData, countDemoData } from './demoData';

describe('demo data', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('counts and clears only demo court entries, keeping preferences', () => {
    localStorage.setItem('cc:solo:docket', '[]');
    localStorage.setItem('cc:solo:teasers:device', '{}');
    localStorage.setItem('cc:versus:log', '[]');
    sessionStorage.setItem('cc:versus:new-case', '{}');
    localStorage.setItem('cc:gj:ballot:1', '{}');
    localStorage.setItem('cc:audio', '{}');
    localStorage.setItem('cc:motion', 'reduced');

    const counts = countDemoData();
    expect(counts.get('cc:solo:')).toBe(2);
    expect(counts.get('cc:versus:')).toBe(2);
    expect(counts.get('cc:gj:')).toBe(1);

    expect(clearDemoData()).toBe(5);
    expect([...countDemoData().values()].every((n) => n === 0)).toBe(true);
    expect(localStorage.getItem('cc:audio')).toBe('{}');
    expect(localStorage.getItem('cc:motion')).toBe('reduced');
  });
});
