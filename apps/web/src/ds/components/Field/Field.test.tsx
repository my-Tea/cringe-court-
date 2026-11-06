import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { axe } from 'vitest-axe';
import { describe, expect, it, vi } from 'vitest';
import { Checkbox, RadioCards, Select, Switch, TextArea, TextField } from './Field';

describe('TextField', () => {
  it('associates the label and wires hint and error via aria-describedby', () => {
    render(<TextField label="Name" hint="Your handle" error="Required" />);
    const input = screen.getByLabelText('Name');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toBeRequired();
    expect(input).toHaveAccessibleDescription('Your handle Required');
    const ids = input.getAttribute('aria-describedby')!.split(' ');
    expect(ids).toHaveLength(2);
    expect(document.getElementById(ids[0]!)).toHaveTextContent('Your handle');
    expect(document.getElementById(ids[1]!)).toHaveTextContent('Required');
  });

  it('is valid without error', () => {
    render(<TextField label="Name" />);
    const input = screen.getByLabelText('Name');
    expect(input).not.toHaveAttribute('aria-invalid');
    expect(input).not.toHaveAttribute('aria-describedby');
  });

  it('optional shows "(optional)" and is not required', () => {
    render(<TextField label="Nickname" optional />);
    expect(screen.getByText('(optional)')).toBeInTheDocument();
    expect(screen.getByLabelText(/Nickname/)).not.toBeRequired();
  });
});

describe('TextArea', () => {
  it('shows a counter and flags overflow without cutting text', async () => {
    render(<TextArea label="Plea" maxLength={5} />);
    const area = screen.getByLabelText('Plea');
    expect(screen.getByText('0/5')).toBeInTheDocument();
    await userEvent.type(area, 'abc');
    expect(screen.getByText('3/5')).toBeInTheDocument();
    expect(area).not.toHaveAttribute('aria-invalid');
    await userEvent.type(area, 'defg');
    expect(area).toHaveValue('abcdefg');
    expect(screen.getByText('7/5')).toBeInTheDocument();
    expect(area).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Keep it to 5 characters.')).toBeInTheDocument();
    expect(area).toHaveAccessibleDescription('Keep it to 5 characters.');
  });
});

describe('Select', () => {
  it('renders options and a placeholder', async () => {
    const onChange = vi.fn();
    render(<Select label="Mode" placeholder="Pick one" options={[{ value: 'a', label: 'Alpha' }, { value: 'b', label: 'Beta' }]} onChange={onChange} />);
    expect(screen.getByRole('option', { name: 'Pick one' })).toBeDisabled();
    expect(screen.getByRole('option', { name: 'Alpha' })).toBeInTheDocument();
    const select = screen.getByLabelText('Mode');
    expect(select).toHaveValue('');
    await userEvent.selectOptions(select, 'b');
    expect(select).toHaveValue('b');
    expect(onChange).toHaveBeenCalled();
  });
});

describe('Checkbox', () => {
  it('toggles', async () => {
    render(<Checkbox label="I agree" description="Terms apply" />);
    const box = screen.getByRole('checkbox', { name: /I agree/ });
    expect(box).not.toBeChecked();
    await userEvent.click(box);
    expect(box).toBeChecked();
    expect(box).toHaveAccessibleDescription('Terms apply');
  });
});

describe('Switch', () => {
  function Controlled({ onChange }: { onChange: (v: boolean) => void }) {
    const [on, setOn] = useState(false);
    return <Switch label="Notifications" checked={on} onCheckedChange={(v) => { setOn(v); onChange(v); }} />;
  }
  it('has role=switch and toggles aria-checked', async () => {
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);
    const sw = screen.getByRole('switch', { name: 'Notifications' });
    expect(sw).toHaveAttribute('aria-checked', 'false');
    await userEvent.click(sw);
    expect(sw).toHaveAttribute('aria-checked', 'true');
    expect(onChange).toHaveBeenLastCalledWith(true);
    await userEvent.click(screen.getByText('Notifications'));
    expect(sw).toHaveAttribute('aria-checked', 'false');
  });
});

describe('RadioCards', () => {
  const options = [
    { value: 'guilty', label: 'Guilty' },
    { value: 'not-cooked', label: 'Not cooked' },
  ];
  it('names the group by its legend and reports clicks and arrow keys', async () => {
    const onValueChange = vi.fn();
    render(<RadioCards legend="Your verdict" name="verdict" options={options} onValueChange={onValueChange} />);
    expect(screen.getByRole('group', { name: 'Your verdict' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: 'Guilty' }));
    expect(onValueChange).toHaveBeenLastCalledWith('guilty');
    await userEvent.keyboard('{ArrowDown}');
    expect(onValueChange).toHaveBeenLastCalledWith('not-cooked');
    expect(screen.getByRole('radio', { name: 'Not cooked' })).toBeChecked();
  });
});

describe('field set accessibility', () => {
  it('has no axe violations', async () => {
    const { container } = render(
      <form>
        <TextField label="Name" hint="Hint" />
        <TextArea label="Plea" maxLength={50} />
        <Select label="Mode" placeholder="Pick" options={[{ value: 'a', label: 'A' }]} />
        <Checkbox label="Agree" />
        <RadioCards legend="Verdict" name="v" options={[{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }]} defaultValue="a" />
      </form>,
    );
    // color-contrast cannot be computed in jsdom; it is covered by tokens.test.ts.
    expect(await axe(container, { rules: { 'color-contrast': { enabled: false } } })).toHaveNoViolations();
  });
});
