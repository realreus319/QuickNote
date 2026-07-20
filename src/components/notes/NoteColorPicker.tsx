import { Palette } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { NoteColor } from '@/types/domain'
import { getNoteColorLabel, NOTE_COLOR_OPTIONS } from '@/utils/noteColor'

interface NoteColorPickerProps {
  color: NoteColor
  onColorChange: (color: NoteColor) => void
}

export function NoteColorPicker({ color, onColorChange }: NoteColorPickerProps) {
  const label = getNoteColorLabel(color)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-lg"
          className="relative rounded-[11px]"
          aria-label={`便签颜色：${label}`}
        >
          <Palette className="size-[18px]" />
          <span
            className="note-color-indicator absolute right-1.5 bottom-1.5 size-2 rounded-full ring-2 ring-[color:var(--note-paper-raised)]"
            data-note-color={color}
            aria-hidden="true"
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="min-w-48 rounded-[13px] p-1.5">
        <DropdownMenuLabel className="px-2 py-1.5 text-[11px] tracking-[0.04em] text-text-muted">
          便签颜色 · {label}
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={color}
          onValueChange={(value) => onColorChange(value as NoteColor)}
        >
          {NOTE_COLOR_OPTIONS.map((option) => (
            <DropdownMenuRadioItem
              key={option.value}
              value={option.value}
              className="h-9 gap-2.5 rounded-[9px] px-2 text-[13px]"
            >
              <span
                className="note-color-swatch size-5 rounded-[6px] border shadow-[inset_0_1px_rgba(255,255,255,0.45)]"
                data-note-color={option.value}
                aria-hidden="true"
              />
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
