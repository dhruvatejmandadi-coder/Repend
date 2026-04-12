/**
 * React hook for running lab simulations via XState + live slider-driven updates.
 */
import { useState, useCallback, useEffect, useRef } from "react";
import {
  buildSimulationMachine,
  createSimulationActor,
  blueprintToSimConfig,
  evaluateFormula,
  checkAnswer,
  evaluateRules,
  computeDerived,
  randomizeVariables,
  checkRandomEvents,
  applyEffects,
  type SimulationConfig,
  type SimVariable,
} from "@/lib/labSimulationEngine";

export type SimulationStatus = "idle" | "running" | "complete";

export function useLabSimulation(blueprint: any) {
  const [simConfig, setSimConfig] = useState<SimulationConfig | null>(null);
  const [status, setStatus] = useState<SimulationStatus>("idle");
  const [variables, setVariables] = useState<Record<string, number>>({});
  const [derivedValues, setDerivedValues] = useState<Record<string, number>>({});
  const [history, setHistory] = useState<Array<{ event: string; from: string; to: string; feedback?: string }>>([]);
  const [firedRules, setFiredRules] = useState<Array<{ message: string }>>([]);
  const [lastFeedback, setLastFeedback] = useState<string | null>(null);
  const [currentStateName, setCurrentStateName] = useState<string>("intro");
  const [goalReached, setGoalReached] = useState(false);
  const actorRef = useRef<any>(null);

  // Initialize simulation from blueprint
  useEffect(() => {
    const config = blueprintToSimConfig(blueprint);
    if (!config) return;

    setSimConfig(config);
    // Randomize initial variable values for replayability
    const initialVars = randomizeVariables(config.variables);
    setVariables(initialVars);
    setDerivedValues(config.formulas ? computeDerived(config.formulas, initialVars) : {});
    setHistory([]);
    setFiredRules([]);
    setLastFeedback(null);
    setCurrentStateName(config.initialState);
    setGoalReached(false);
    setStatus("idle");

    try {
      const machine = buildSimulationMachine(config);
      const actor = createSimulationActor(machine);
      
      actor.subscribe((snapshot) => {
        const ctx = snapshot.context as any;
        setVariables(ctx.variables || {});
        setDerivedValues(ctx.derivedValues || {});
        setHistory(ctx.history || []);
        setFiredRules(ctx.firedRules || []);
        setLastFeedback(ctx.lastFeedback || null);
        setCurrentStateName(String(snapshot.value));
        
        if (String(snapshot.value) === "complete") {
          setStatus("complete");
        }
      });

      actor.start();
      actorRef.current = actor;
      setStatus("running");
    } catch (e) {
      console.warn("Failed to build simulation machine:", e);
      setSimConfig(null);
    }

    return () => {
      if (actorRef.current) {
        actorRef.current.stop();
        actorRef.current = null;
      }
    };
  }, [blueprint]);

  /**
   * Update a single variable via slider — triggers rules + derived recalc in real-time.
   */
  const updateVariable = useCallback((name: string, value: number) => {
    if (!simConfig) return;
    
    setVariables(prev => {
      const updated = { ...prev, [name]: value };
      
      // Evaluate rules
      const ruleResult = evaluateRules(simConfig.rules || [], updated, simConfig.variables);
      const afterRules = ruleResult.variables;
      
      // Check random events (low probability per slider change)
      let afterEvents = afterRules;
      let eventMessages: string[] = [];
      if (simConfig.randomEvents && Math.random() < 0.1) { // 10% chance per slider change
        const evtResult = checkRandomEvents(simConfig.randomEvents, afterRules, simConfig.variables);
        afterEvents = evtResult.variables;
        eventMessages = evtResult.messages;
      }
      
      // Compute derived values
      if (simConfig.formulas) {
        setDerivedValues(computeDerived(simConfig.formulas, afterEvents));
      }
      
      // Show feedback from rules/events
      const allMessages = [...ruleResult.messages, ...eventMessages];
      if (allMessages.length > 0) {
        setLastFeedback(allMessages.join(" | "));
        setFiredRules(prev => [...prev, ...allMessages.map(m => ({ message: m }))]);
      }
      
      // Check goal
      if (simConfig.goal?.condition) {
        try {
          const { evalCondition } = require("@/lib/labSimulationEngine");
          setGoalReached(evalCondition(simConfig.goal.condition, afterEvents));
        } catch { /* ignore */ }
      }
      
      return afterEvents;
    });
  }, [simConfig]);

  const sendEvent = useCallback((event: string) => {
    if (actorRef.current) {
      actorRef.current.send({ type: event });
    }
  }, []);

  const reset = useCallback(() => {
    if (!simConfig) return;
    if (actorRef.current) {
      actorRef.current.stop();
    }
    try {
      const machine = buildSimulationMachine(simConfig);
      const actor = createSimulationActor(machine);
      
      actor.subscribe((snapshot) => {
        const ctx = snapshot.context as any;
        setVariables(ctx.variables || {});
        setDerivedValues(ctx.derivedValues || {});
        setHistory(ctx.history || []);
        setFiredRules(ctx.firedRules || []);
        setLastFeedback(ctx.lastFeedback || null);
        setCurrentStateName(String(snapshot.value));
        
        if (String(snapshot.value) === "complete") {
          setStatus("complete");
        }
      });

      actor.start();
      actorRef.current = actor;

      // Re-randomize for different experience each time
      const initialVars = randomizeVariables(simConfig.variables);
      setVariables(initialVars);
      setDerivedValues(simConfig.formulas ? computeDerived(simConfig.formulas, initialVars) : {});
      setHistory([]);
      setFiredRules([]);
      setLastFeedback(null);
      setCurrentStateName(simConfig.initialState);
      setGoalReached(false);
      setStatus("running");
    } catch (e) {
      console.warn("Failed to rebuild simulation:", e);
    }
  }, [simConfig]);

  const evalFormula = useCallback((formula: string) => {
    return evaluateFormula(formula, variables);
  }, [variables]);

  const validateAnswer = useCallback((userAnswer: string, correctAnswer: string, tolerance?: number) => {
    return checkAnswer(userAnswer, correctAnswer, tolerance);
  }, []);

  return {
    isSimulation: simConfig !== null,
    status,
    variables,
    derivedValues,
    history,
    firedRules,
    lastFeedback,
    currentStateName,
    simConfig,
    goalReached,
    sendEvent,
    updateVariable,
    reset,
    evalFormula,
    validateAnswer,
  };
}
