import StepItem from "./StepItem";
import Chevron from "./Chevron";

function WizardHeader({ current = 1 }: { current?: 1 | 2 | 3 }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 text-sm font-medium text-gray-700 py-2 sm:py-3">
      <StepItem num={1} label="About You" active={current === 1} />
      <Chevron />
      <StepItem num={2} label="Brand Story & Offerings" active={current === 2} dim />
      <Chevron />
      <StepItem num={3} label="Verification & Business Setup" active={current === 3} dim />
    </div>
  );
}

export default WizardHeader;
