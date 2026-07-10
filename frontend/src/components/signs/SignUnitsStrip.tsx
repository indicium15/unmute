import type { SignUnit } from "@/components/signs/types"

interface SignUnitsStripProps {
  units?: SignUnit[]
}

export function SignUnitsStrip({ units }: SignUnitsStripProps) {
  if (!units || units.length === 0) return null

  return (
    <div className="bg-white border border-[#e5e7eb] rounded-[20px] p-6 shadow-sm">
      <h3 className="text-[16px] font-semibold text-[#101828] mb-4">Units of Sign</h3>
      <div className="grid grid-cols-3 gap-3">
        {units.map((unit, i) => (
          <div
            key={`${unit.step}-${i}`}
            className="border border-[#f3f4f6] rounded-[12px] bg-[#fafafa] overflow-hidden"
          >
            <div className="aspect-square bg-[#f8f9ff] flex items-center justify-center">
              <img
                src={unit.image_url}
                alt={`Step ${i + 1}`}
                className="w-full h-full object-contain"
              />
            </div>
            <p className="text-center text-[12px] font-medium text-[#4a5565] py-2">
              Step {i + 1}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
