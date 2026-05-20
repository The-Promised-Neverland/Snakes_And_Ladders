"use client";

import * as React from "react";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Castle,
  Globe2,
  Lock,
  MessagesSquare,
  SendHorizonal,
  SmilePlus,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/types/game";

interface ChatPanelProps {
  playerName: string;
  isConnected: boolean;
  globalMessages: ChatMessage[];
  roomMessages?: ChatMessage[];
  allowRoomChat?: boolean;
  roomName?: string | null;
  className?: string;
  onSendGlobalMessage: (message: string) => string | null;
  onSendRoomMessage?: (message: string) => string | null;
}

function formatMessageTime(sentAt: number): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(sentAt);
}

export function ChatPanel({
  playerName,
  isConnected,
  globalMessages,
  roomMessages = [],
  allowRoomChat = false,
  roomName,
  className,
  onSendGlobalMessage,
  onSendRoomMessage,
}: ChatPanelProps) {
  const [activeTab, setActiveTab] = useState<"global" | "room">("global");
  const [globalDraft, setGlobalDraft] = useState("");
  const [roomDraft, setRoomDraft] = useState("");
  const [composerError, setComposerError] = useState<string | null>(null);
  const globalScrollRef = useRef<HTMLDivElement | null>(null);
  const roomScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!allowRoomChat && activeTab === "room") {
      setActiveTab("global");
    }
  }, [activeTab, allowRoomChat]);

  useEffect(() => {
    if (globalScrollRef.current) {
      globalScrollRef.current.scrollTop = globalScrollRef.current.scrollHeight;
    }
  }, [globalMessages]);

  useEffect(() => {
    if (roomScrollRef.current) {
      roomScrollRef.current.scrollTop = roomScrollRef.current.scrollHeight;
    }
  }, [roomMessages]);

  const handleSend = (scope: "global" | "room") => {
    const draft = scope === "global" ? globalDraft : roomDraft;
    const message = draft.trim();
    if (!message) {
      return;
    }

    const sendError =
      scope === "global"
        ? onSendGlobalMessage(message)
        : onSendRoomMessage?.(message) ?? "Room chat is not available yet.";

    if (sendError) {
      setComposerError(sendError);
      return;
    }

    setComposerError(null);
    if (scope === "global") {
      setGlobalDraft("");
      return;
    }
    setRoomDraft("");
  };

  const handleComposerKeyDown = (
    event: React.KeyboardEvent<HTMLTextAreaElement>,
    scope: "global" | "room"
  ) => {
    if (event.key !== "Enter" || event.shiftKey) {
      return;
    }
    event.preventDefault();
    handleSend(scope);
  };

  return (
    <Card
      className={cn(
        "overflow-hidden border-2 border-border/50 bg-card/85 shadow-xl backdrop-blur-sm",
        className
      )}
    >
      <CardHeader className="relative overflow-hidden border-b border-border/50 bg-[radial-gradient(circle_at_top,_rgba(217,119,6,0.16),_transparent_58%),linear-gradient(135deg,rgba(120,53,15,0.06),rgba(34,197,94,0.08))] pb-4">
        <div className="absolute right-4 top-3 opacity-20">
          <Sparkles className="h-14 w-14 text-primary" />
        </div>
        <div className="relative flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              <MessagesSquare className="h-5 w-5 text-primary" />
              Campfire Chat
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Global messages stay open everywhere. Room chat appears once you are inside a room.
            </p>
          </div>
          <Badge
            variant="outline"
            className={cn(
              "border-0 px-3 py-1 text-xs shadow-sm",
              isConnected
                ? "bg-emerald-500/15 text-emerald-700"
                : "bg-muted text-muted-foreground"
            )}
          >
            <span
              className={cn(
                "mr-2 inline-block h-2 w-2 rounded-full",
                isConnected ? "bg-emerald-500" : "bg-muted-foreground/50"
              )}
            />
            {isConnected ? "Live" : "Offline"}
          </Badge>
        </div>
        <div className="relative mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="secondary" className="bg-primary/10 text-primary">
            Speaker: {playerName}
          </Badge>
          <Badge variant="secondary" className="bg-secondary/70">
            <SmilePlus className="mr-1 h-3.5 w-3.5" />
            Emoji-friendly input
          </Badge>
          {allowRoomChat && roomName && (
            <Badge variant="secondary" className="bg-accent/15 text-accent-foreground">
              Room: {roomName}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-4">
        {allowRoomChat ? (
          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as "global" | "room")}
            className="gap-4"
          >
            <TabsList className="grid h-auto w-full grid-cols-2 rounded-xl bg-muted/70 p-1">
              <TabsTrigger value="global" className="rounded-lg py-2">
                <Globe2 className="h-4 w-4" />
                Global
              </TabsTrigger>
              <TabsTrigger value="room" className="rounded-lg py-2">
                <Castle className="h-4 w-4" />
                Room
              </TabsTrigger>
            </TabsList>

            <TabsContent value="global" className="mt-0">
              <ChatFeed
                ref={globalScrollRef}
                messages={globalMessages}
                localPlayerName={playerName}
                emptyTitle="No global chatter yet"
                emptyText="Break the silence with a greeting, strategy, or a line of emoji."
              />
              <ChatComposer
                disabled={!isConnected}
                value={globalDraft}
                onChange={(value) => {
                  setComposerError(null);
                  setGlobalDraft(value);
                }}
                onSend={() => handleSend("global")}
                onKeyDown={(event) => handleComposerKeyDown(event, "global")}
                placeholder="Send a global message to everyone..."
                error={activeTab === "global" ? composerError : null}
              />
            </TabsContent>

            <TabsContent value="room" className="mt-0">
              <ChatFeed
                ref={roomScrollRef}
                messages={roomMessages}
                localPlayerName={playerName}
                emptyTitle="Your room is quiet"
                emptyText="Use room chat for strategy, celebration, or dramatic warnings about snakes."
              />
              <ChatComposer
                disabled={!isConnected}
                value={roomDraft}
                onChange={(value) => {
                  setComposerError(null);
                  setRoomDraft(value);
                }}
                onSend={() => handleSend("room")}
                onKeyDown={(event) => handleComposerKeyDown(event, "room")}
                placeholder="Talk only to players in this room..."
                error={activeTab === "room" ? composerError : null}
              />
            </TabsContent>
          </Tabs>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-xl border border-border/50 bg-muted/25 px-3 py-2">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Globe2 className="h-4 w-4 text-primary" />
                Global channel
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Lock className="h-3.5 w-3.5" />
                Room chat unlocks after joining
              </div>
            </div>
            <ChatFeed
              ref={globalScrollRef}
              messages={globalMessages}
              localPlayerName={playerName}
              emptyTitle="No lobby messages yet"
              emptyText="This is the shared campfire. Say hello before you join a room."
            />
            <ChatComposer
              disabled={!isConnected}
              value={globalDraft}
              onChange={(value) => {
                setComposerError(null);
                setGlobalDraft(value);
              }}
              onSend={() => handleSend("global")}
              onKeyDown={(event) => handleComposerKeyDown(event, "global")}
              placeholder="Send a global message to everyone..."
              error={composerError}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface ChatFeedProps {
  messages: ChatMessage[];
  localPlayerName: string;
  emptyTitle: string;
  emptyText: string;
}

const ChatFeed = React.forwardRef<HTMLDivElement, ChatFeedProps>(function ChatFeed(
  { messages, localPlayerName, emptyTitle, emptyText },
  ref
) {
  if (messages.length === 0) {
    return (
      <div className="mb-4 flex h-[320px] flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),transparent)] px-6 text-center">
        <MessagesSquare className="mb-4 h-10 w-10 text-muted-foreground/50" />
        <p className="font-semibold text-foreground">{emptyTitle}</p>
        <p className="mt-2 max-w-xs text-sm leading-6 text-muted-foreground">
          {emptyText}
        </p>
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className="mb-4 flex h-[320px] flex-col gap-3 overflow-y-auto rounded-2xl border border-border/60 bg-[linear-gradient(180deg,rgba(120,53,15,0.05),rgba(34,197,94,0.03))] p-3"
    >
      <AnimatePresence initial={false}>
        {messages.map((message) => {
          const isOwnMessage = message.playerName === localPlayerName;
          return (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className={cn("flex", isOwnMessage ? "justify-end" : "justify-start")}
            >
              <div
                className={cn(
                  "max-w-[86%] rounded-2xl border px-4 py-3 shadow-sm",
                  isOwnMessage
                    ? "border-primary/40 bg-primary text-primary-foreground"
                    : "border-border/50 bg-card/90 text-card-foreground"
                )}
              >
                <div
                  className={cn(
                    "mb-1 flex items-center gap-2 text-xs",
                    isOwnMessage
                      ? "text-primary-foreground/80"
                      : "text-muted-foreground"
                  )}
                >
                  <span className="font-semibold">
                    {isOwnMessage ? "You" : message.playerName}
                  </span>
                  <span>{formatMessageTime(message.sentAt)}</span>
                </div>
                <p className="whitespace-pre-wrap break-words text-sm leading-6">
                  {message.message}
                </p>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
});

interface ChatComposerProps {
  disabled: boolean;
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder: string;
  error: string | null;
}

function ChatComposer({
  disabled,
  value,
  onChange,
  onSend,
  onKeyDown,
  placeholder,
  error,
}: ChatComposerProps) {
  const canSend = value.trim().length > 0 && !disabled;

  return (
    <div className="space-y-3">
      <Textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={3}
        className="min-h-[96px] rounded-2xl border-2 bg-background/70 pr-14 text-sm leading-6"
      />
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Press Enter to send. Use Shift+Enter for a new line.
        </p>
        <Button
          type="button"
          onClick={onSend}
          disabled={!canSend}
          className="h-11 rounded-xl px-5 shadow-md"
        >
          <SendHorizonal className="mr-2 h-4 w-4" />
          Send
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
