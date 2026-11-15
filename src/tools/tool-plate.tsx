interface ToolPlateProps {
  readonly lines: readonly string[]
  readonly attribution: string
}

export function ToolPlate({ lines, attribution }: ToolPlateProps) {
  return (
    <div className="pointer-events-none absolute right-1/2 bottom-3 left-3 mr-6 flex">
      <div className="rounded-md border border-line bg-panel px-3 py-2">
        {lines.map((line) => (
          <p key={line} className="tnum text-meta text-text-2">
            {line}
          </p>
        ))}
        <p className="text-meta text-text-3">{attribution}</p>
      </div>
    </div>
  )
}
