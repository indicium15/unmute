const ROW_ORDER = ["Handshape", "Orientation", "Location", "Movements", "Non-manual Markers"]

interface SignParametersTableProps {
  parameters?: Record<string, Record<string, string>>
}

export function SignParametersTable({ parameters }: SignParametersTableProps) {
  if (!parameters || Object.keys(parameters).length === 0) return null

  const rows = ROW_ORDER.filter((row) => parameters[row])
  if (rows.length === 0) return null

  return (
    <div className="bg-white border border-[#e5e7eb] rounded-[20px] p-6 shadow-sm">
      <h3 className="text-[16px] font-semibold text-[#101828] mb-4">Parameters of Sign</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr>
              <th className="pb-2 pr-4 text-[12px] font-medium text-[#6a7282]"></th>
              <th className="pb-2 pr-4 text-[13px] font-semibold text-[#364153]">Dominant Hand</th>
              <th className="pb-2 text-[13px] font-semibold text-[#364153]">Non-Dominant Hand</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row} className="border-t border-[#f3f4f6]">
                <td className="py-3 pr-4 text-[13px] font-medium text-[#364153] whitespace-nowrap align-top">
                  {row}
                </td>
                <td className="py-3 pr-4 text-[13px] text-[#4a5565] align-top">
                  {parameters[row]["Dominant Hand"] ?? "—"}
                </td>
                <td className="py-3 text-[13px] text-[#4a5565] align-top">
                  {parameters[row]["Non-Dominant Hand"] ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
