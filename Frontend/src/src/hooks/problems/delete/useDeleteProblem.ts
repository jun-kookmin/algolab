"use client";

import { useMutation, useQueryClient, type UseMutationOptions } from "@tanstack/react-query";

import BaseApi from "@/utils/api";

export type DeleteProblemResponse = void;

const deleteProblem = async (problemUuid: string): Promise<DeleteProblemResponse> => {
    await BaseApi.delete(`/instructor/problems/${problemUuid}/`);
    return undefined;
};

export const useDeleteProblem = (
    options?: UseMutationOptions<DeleteProblemResponse, Error, string>
) => {
    const qc = useQueryClient();

    return useMutation<DeleteProblemResponse, Error, string>({
        mutationFn: deleteProblem,
        onSuccess: async (data, variables, context) => {
            await Promise.allSettled([
                qc.invalidateQueries({ queryKey: ["problems"] }),
                qc.invalidateQueries({ queryKey: ["problem", variables] }),
            ]);
            options?.onSuccess?.(data, variables, context);
        },
        onError: (error, variables, context) => {
            options?.onError?.(error, variables, context);
        },
        ...options,
    });
};
