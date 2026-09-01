"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api, type IndexTriggerResponse, type Repository, ApiError } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import {
 Dialog,
 DialogContent,
 DialogDescription,
 DialogFooter,
 DialogHeader,
 DialogTitle,
 DialogTrigger,
 DialogClose
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export function AddPublicRepo() {
 const [open, setOpen] = useState(false);
 const [input, setInput] = useState("");
 const [errorMsg, setErrorMsg] = useState<string | null>(null);
 
 const queryClient = useQueryClient();

 const handleOutcome = (data: IndexTriggerResponse) => {
 queryClient.setQueryData(queryKeys.repos.list(), (old: Repository[] | undefined) => {
 if (!old) return [data.repository];
 const exists = old.find((r) => r.id === data.repository.id);
 if (exists) {
 return old.map((r) => r.id === data.repository.id ? data.repository : r);
 }
 return [data.repository, ...old];
 });
 
 if (data.outcome === "STARTED_INDEXING") {
 toast.add({ type: "success", title: "Indexing started" });
 } else if (data.outcome === "ATTACHED_EXISTING") {
 toast.add({ type: "success", title: "Repo added — already indexed and ready" });
 } else if (data.outcome === "ALREADY_IN_PROGRESS") {
 toast.add({ type: "info", title: "Repo added — indexing in progress" });
 } else if (data.outcome === "ALREADY_UP_TO_DATE") {
 toast.add({ type: "info", title: "Already up to date — no changes found" });
 }

 setOpen(false);
 setInput("");
 setErrorMsg(null);
 };

 const handleError = (error: unknown) => {
 if (error instanceof ApiError) {
 if (error.status === 400) {
 setErrorMsg("Enter a valid owner/repo or GitHub URL");
 } else if (error.status === 404) {
 setErrorMsg("Repository not found or not accessible");
 } else if (error.status === 403) {
 setErrorMsg("Access to this repository is forbidden");
 } else if (error.status === 429) {
 const hours = error.retryAfter ? Math.ceil(error.retryAfter / 3600) : 24;
 toast.add({ type: "warning", title: `Rate limit reached — try again in ${hours} hour${hours !== 1 ? 's' : ''}` });
 setErrorMsg(null);
 } else {
 setErrorMsg(error.message || "Failed to add repository");
 }
 } else {
 setErrorMsg("An unexpected error occurred");
 }
 };

 const mutation = useMutation({
 mutationFn: (inputVal: string) => api.addPublicRepo(inputVal),
 onSuccess: handleOutcome,
 onError: handleError,
 });

 const handleSubmit = (e: React.FormEvent) => {
 e.preventDefault();
 setErrorMsg(null);
 if (!input.trim()) return;
 mutation.mutate(input.trim());
 };

 return (
 <Dialog open={open} onOpenChange={(o) => {
 setOpen(o);
 if (!o) {
 setErrorMsg(null);
 }
 }}>
 <DialogTrigger
 render={
 <Button
 variant="outline"
 className="border-border bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground rounded-sm font-mono text-xs"
 />
 }
 >
 <Plus className="size-3.5 mr-2" />
 add public repo
 </DialogTrigger>
 
 <DialogContent className="border border-border bg-background rounded-sm p-5 sm:max-w-md gap-5">
 <DialogHeader className="gap-1">
 <DialogTitle className="font-mono text-base font-normal text-foreground">
 Add Public Repository
 </DialogTitle>
 <DialogDescription className="font-mono text-xs text-muted-foreground/80">
 Enter a GitHub repository URL or owner/repo to add it to your workspace.
 </DialogDescription>
 </DialogHeader>
 
 <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
 <div className="space-y-2">
 <Input
 value={input}
 onChange={(e) => {
 setInput(e.target.value);
 if (errorMsg) setErrorMsg(null);
 }}
 placeholder="e.g. spring-projects/spring-boot"
 className={cn(
 "font-mono text-sm border-border bg-muted/30 rounded-sm focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-background",
 errorMsg && "border-destructive/50 focus-visible:ring-destructive"
 )}
 disabled={mutation.isPending}
 />
 {errorMsg && (
 <p className="font-mono text-xs text-destructive">{errorMsg}</p>
 )}
 </div>
 
 <DialogFooter className="bg-transparent border-t-0 p-0 sm:justify-end gap-2 mt-2">
 <DialogClose
 render={
 <Button 
 variant="outline" 
 className="rounded-sm font-mono text-xs border-border bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
 />
 }
 >
 cancel
 </DialogClose>
 <Button
 type="submit"
 disabled={mutation.isPending || !input.trim()}
 className="rounded-sm font-mono text-xs bg-primary text-primary-foreground hover:opacity-90"
 >
 {mutation.isPending ? <Spinner className="size-3.5 mr-2" /> : null}
 {mutation.isPending ? "adding..." : "add repository"}
 </Button>
 </DialogFooter>
 </form>
 </DialogContent>
 </Dialog>
 );
}
