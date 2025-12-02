import React, { createContext, useContext, useState } from "react";

const ExamContext = createContext();

export function ExamProvider({ children }) {
  const [activeExamId, setActiveExamId] = useState(null);

  return (
    <ExamContext.Provider value={{ activeExamId, setActiveExamId }}>
      {children}
    </ExamContext.Provider>
  );
}

export function useExamContext() {
  const context = useContext(ExamContext);
  if (!context) {
    throw new Error("useExamContext must be used within ExamProvider");
  }
  return context;
}
