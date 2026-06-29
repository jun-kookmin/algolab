"use client";

import React, { useState } from "react";
import AddProblemFirstStep from "@/components/addProblem/AddProblemFirstStep";
import AddProblemSecondStep from "@/components/addProblem/AddProblemSecondStep";
import type { AddProblemFormProps, WizardStep } from "@/types/problemCreation";

const AddProblemForm: React.FC<AddProblemFormProps> = ({
    onStepChange,
    onSubmit,
    ...delegatedProps
}) => {
    const [step, setStep] = useState<WizardStep>(1);

    const changeStep = (next: WizardStep) => {
        setStep(next);
        onStepChange(next);
    };

    if (step === 1) {
        return <AddProblemFirstStep {...delegatedProps} onNext={() => changeStep(2)} />;
    }

    return (
        <AddProblemSecondStep
            {...delegatedProps}
            onBack={() => changeStep(1)}
            onSubmit={onSubmit}
        />
    );
};

export default AddProblemForm;
