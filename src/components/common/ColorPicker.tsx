import React from 'react';

const COLORS = [
  '#EF4444', // red
  '#F97316', // orange
  '#EAB308', // yellow
  '#22C55E', // green
  '#14B8A6', // teal
  '#3B82F6', // blue
  '#6366F1', // indigo
  '#A855F7', // purple
  '#EC4899', // pink
  '#64748B', // slate
];

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
}

export const ColorPicker: React.FC<ColorPickerProps> = ({ value, onChange }) => {
  return (
    <div className="flex flex-wrap gap-2">
      {COLORS.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => onChange(color)}
          className="w-7 h-7 rounded-full border-2 transition-all"
          style={{
            backgroundColor: color,
            borderColor: value === color ? '#1e293b' : 'transparent',
            transform: value === color ? 'scale(1.15)' : 'scale(1)',
          }}
          title={color}
        />
      ))}
    </div>
  );
};
