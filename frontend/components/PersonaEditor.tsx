"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { connectionsApi } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { Button } from "@/components/ds/Button";
import { X } from "lucide-react";

interface PersonaEditorProps {
  connectionId: string;
  initialPersona?: string | null;
  onSave?: (persona: string) => void;
  onClose?: () => void;
  inline?: boolean;
}

export default function PersonaEditor({
  connectionId,
  initialPersona,
  onSave,
  onClose,
  inline = false,
}: PersonaEditorProps) {
  const [description, setDescription] = useState(initialPersona || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initialPersona) setDescription(initialPersona);
  }, [initialPersona]);

  const isValid = description.length >= 20 && description.length <= 500;

  async function handleSave() {
    const token = getToken();
    if (!token || !isValid) return;
    setSaving(true);
    try {
      await connectionsApi.updateConnection(token, connectionId, {
        persona: description,
      });
      toast.success("Persona salva com sucesso!");
      onSave?.(description);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao salvar";
      toast.error("Erro ao salvar persona", { description: msg });
    } finally {
      setSaving(false);
    }
  }

  const content = (
    <div className="space-y-3">
      <div>
        <label
          style={{
            fontSize: "0.78rem",
            fontWeight: 600,
            color: "var(--text-primary)",
            display: "block",
            marginBottom: 6,
          }}
        >
          Descreva seu negocio ou perfil
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Ex: Loja de roupas femininas focada em moda sustentavel, publico 25-40 anos, vendas pelo Instagram..."
          className="w-full rounded-xl p-3 resize-none focus:outline-none transition-all"
          style={{
            fontSize: "0.82rem",
            backgroundColor: "var(--bg-subtle)",
            border: `1px solid ${description.length > 0 && description.length < 20 ? "var(--sentiment-negative)" : "var(--border)"}`,
            color: "var(--text-primary)",
            minHeight: 100,
          }}
          rows={4}
          maxLength={500}
        />
        <div className="flex items-center justify-between mt-1">
          <p
            style={{
              fontSize: "0.62rem",
              color:
                description.length > 0 && description.length < 20
                  ? "var(--sentiment-negative)"
                  : "var(--text-faint)",
            }}
          >
            {description.length < 20
              ? `Minimo 20 caracteres (${description.length}/20)`
              : `${description.length}/500`}
          </p>
        </div>
      </div>
      <div className="flex items-center justify-end gap-2">
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancelar
          </Button>
        )}
        <Button
          variant="primary"
          size="sm"
          onClick={handleSave}
          disabled={!isValid || saving}
        >
          {saving ? "Salvando..." : "Salvar persona"}
        </Button>
      </div>
    </div>
  );

  if (inline) return content;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-[70] p-4"
      style={{
        backgroundColor: "rgba(0,0,0,0.4)",
        backdropFilter: "blur(8px)",
      }}
    >
      <div
        className="rounded-2xl p-6 max-w-md w-full relative"
        style={{
          backgroundColor: "var(--bg-card)",
          border: "1px solid var(--border)",
          boxShadow: "0 24px 48px -12px rgba(0,0,0,0.18)",
        }}
      >
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1 rounded-lg transition-colors"
            style={{ color: "var(--text-faint)" }}
          >
            <X className="w-4 h-4" />
          </button>
        )}
        <h2
          style={{
            fontFamily: "'Outfit', sans-serif",
            fontSize: "1.1rem",
            fontWeight: 700,
            color: "var(--text-primary)",
            marginBottom: 16,
          }}
        >
          Persona do perfil
        </h2>
        <p
          style={{
            fontSize: "0.82rem",
            color: "var(--text-muted)",
            marginBottom: 16,
          }}
        >
          A persona ajuda a IA a entender o contexto do seu perfil para uma
          analise mais precisa dos comentarios.
        </p>
        {content}
      </div>
    </div>
  );
}
