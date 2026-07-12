import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader } from "@/components/ui/loader";
import {
  Upload,
  X,
  Globe,
  Phone,
  Mail,
  MapPin,
  Image,
  Briefcase,
  Hash,
  Save,
  ChevronsUpDown,
  Building2,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { COUNTRIES } from "@/data/mockData";
import { companyProfileApi } from "@/lib/api";
import { z } from "zod";
import { cn } from "@/lib/utils";

const companyInputClass =
  "border-[#0C2242]/12 focus-visible:border-[#29b3FF] focus-visible:ring-2 focus-visible:ring-[#29b3FF]/25";

const companySchema = z.object({
  name: z.string().trim().min(1, "Company name is required").max(100),
  email: z.string().trim().email("Invalid email").or(z.literal("")).optional(),
  phone: z.string().trim().max(20).optional(),
  website: z.string().trim().url("Invalid URL").or(z.literal("")).optional(),
  address: z.string().trim().max(255).optional(),
  city: z.string().trim().max(100).optional(),
  country: z.string().optional(),
  industry: z.string().trim().max(100).optional(),
  taxId: z.string().trim().max(50).optional(),
  description: z.string().trim().max(500).optional(),
});

type CompanyForm = z.infer<typeof companySchema>;

const initialForm: CompanyForm = {
  name: "",
  email: "",
  phone: "",
  website: "",
  address: "",
  city: "",
  country: "",
  industry: "",
  taxId: "",
  description: "",
};

function FieldWrapper({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-semibold text-[#0C2242] dark:text-[#D7EFFF]">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {children}
      {error && (
        <p className="text-xs text-destructive flex items-center gap-1.5">
          <span className="inline-block h-1 w-1 rounded-full bg-destructive shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}

export function CompanySettings() {
  const [form, setForm] = useState<CompanyForm>(initialForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [countryOpen, setCountryOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    companyProfileApi
      .get()
      .then((data) => {
        if (cancelled) return;
        setForm({
          name: data.name ?? "",
          email: data.email ?? "",
          phone: data.phone ?? "",
          website: data.website ?? "",
          address: data.address ?? "",
          city: data.city ?? "",
          country: data.country ?? "",
          industry: data.industry ?? "",
          taxId: data.taxId ?? "",
          description: data.description ?? "",
        });
        if (data.logo) setLogoPreview(data.logo);
      })
      .catch(() => toast.error("Failed to load company profile"))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const update = (key: keyof CompanyForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key])
      setErrors((prev) => {
        const n = { ...prev };
        delete n[key];
        return n;
      });
  };

  const processFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be under 2MB");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => setLogoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const removeLogo = () => {
    setLogoPreview(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleSave = async () => {
    const result = companySchema.safeParse(form);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((e) => {
        fieldErrors[e.path[0] as string] = e.message;
      });
      setErrors(fieldErrors);
      toast.error("Please fix the errors before saving");
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      await companyProfileApi.update({
        name: form.name,
        email: form.email || undefined,
        phone: form.phone || undefined,
        website: form.website || undefined,
        address: form.address || undefined,
        city: form.city || undefined,
        country: form.country || undefined,
        industry: form.industry || undefined,
        taxId: form.taxId || undefined,
        description: form.description || undefined,
        logo: logoPreview || null,
      });
      toast.success("Company settings saved successfully");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <Loader message="Loading company profile…" size="lg" className="py-16" />;
  }

  return (
    <div className="flex h-[calc(100vh-18rem)] min-h-[min(320px,70vh)] w-full max-w-none flex-col sm:h-[calc(100vh-15rem)]">
      {/* Fixed at top of this panel; cards + hint scroll in the region below */}
      <div className="mb-4 shrink-0 rounded-2xl border border-[#0C2242]/15 bg-gradient-to-br from-[#D7EFFF]/50 via-white to-white px-6 py-5 shadow-[0_8px_30px_-12px_rgba(12,34,66,0.18)] dark:border-[#29b3FF]/20 dark:from-[#0C2242]/40 dark:via-[#0C2242]/25 dark:to-[#0C2242]/15">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#0C2242]/10 bg-[#D7EFFF] dark:border-[#29b3FF]/30 dark:bg-[#0C2242]/80">
              <Building2 className="h-5 w-5 text-[#0C2242] dark:text-[#29b3FF]" />
            </div>
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-[#0C2242] sm:text-2xl dark:text-[#D7EFFF]">
                Company profile
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-[#999999] dark:text-[#999999]/90">
                Logo, legal details, contact, and address — one place, like an employee profile.
              </p>
            </div>
          </div>
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="h-10 shrink-0 gap-2 rounded-full border-0 bg-[#0C2242] px-6 font-semibold text-white shadow-md shadow-[#0C2242]/20 transition-colors hover:bg-[#0a1a35] focus-visible:ring-2 focus-visible:ring-[#29b3FF] focus-visible:ring-offset-2 disabled:opacity-60 dark:hover:bg-[#152a4d]"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Saving…" : "Save profile"}
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain pr-1 -mr-1">
        <div className="grid w-full grid-cols-1 gap-6 pb-4 lg:grid-cols-2">
          <Card className="h-full overflow-hidden border-[#0C2242]/10 shadow-sm dark:border-[#29b3FF]/15">
            <CardHeader className="border-b border-[#0C2242]/8 bg-[#D7EFFF]/35 pb-4 dark:border-[#29b3FF]/15 dark:bg-[#0C2242]/30">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#D7EFFF] dark:bg-[#0C2242]/90">
                  <Image className="h-5 w-5 text-[#29b3FF] dark:text-[#29b3FF]" />
                </div>
                <div>
                  <CardTitle className="text-lg text-[#0C2242] dark:text-[#D7EFFF]">Logo & brand</CardTitle>
                  <CardDescription className="text-[#999999] dark:text-[#999999]/85">
                    Used in headers, PDFs, and customer-facing screens.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
                <div
                  className={cn(
                    "relative flex h-32 w-32 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed transition-all duration-200",
                    isDragging
                      ? "scale-[1.02] border-[#29b3FF] bg-[#D7EFFF]/60 shadow-lg ring-2 ring-[#29b3FF]/35"
                      : logoPreview
                        ? "border-[#0C2242]/20 bg-[#D7EFFF]/20 hover:border-[#29b3FF]/50 dark:border-[#29b3FF]/25 dark:bg-[#0C2242]/20"
                        : "border-[#0C2242]/18 bg-[#D7EFFF]/25 hover:border-[#29b3FF] hover:bg-[#D7EFFF]/40 dark:border-[#29b3FF]/20 dark:bg-[#0C2242]/25",
                  )}
                  onClick={() => fileRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                >
                  {logoPreview ? (
                    <>
                      <img src={logoPreview} alt="Company logo" className="h-full w-full object-cover" />
                      <div className="absolute inset-0 flex items-center justify-center bg-[#0C2242]/60 opacity-0 transition-opacity hover:opacity-100">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeLogo();
                          }}
                          className="flex h-9 w-9 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-lg transition-transform hover:scale-105"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-2 px-3 text-center text-[#999999]">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#D7EFFF]/80 dark:bg-[#0C2242]/60">
                        <Upload className="h-5 w-5 text-[#29b3FF]" />
                      </div>
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-[#0C2242] dark:text-[#D7EFFF]">
                        Drop or click
                      </span>
                    </div>
                  )}
                </div>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogo} />
                <div className="min-w-0 flex-1 space-y-3">
                  <p className="text-sm font-semibold text-[#0C2242] dark:text-[#D7EFFF]">Upload logo</p>
                  <p className="text-sm leading-relaxed text-[#999999]">
                    PNG, JPG, or SVG — max 2MB. Square images around <span className="font-mono text-xs text-[#0C2242]/80 dark:text-[#D7EFFF]/80">256×256</span>{" "}
                    look best.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-lg border-[#0C2242]/20 text-[#0C2242] hover:bg-[#D7EFFF]/50 dark:border-[#29b3FF]/35 dark:text-[#D7EFFF] dark:hover:bg-[#0C2242]/40"
                    onClick={() => fileRef.current?.click()}
                  >
                    <Upload className="mr-2 h-3.5 w-3.5" />
                    Choose file
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="h-full border-[#0C2242]/10 shadow-sm dark:border-[#29b3FF]/15">
            <CardHeader className="border-b border-[#0C2242]/8 bg-[#D7EFFF]/35 pb-4 dark:border-[#29b3FF]/15 dark:bg-[#0C2242]/30">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#D7EFFF] dark:bg-[#0C2242]/90">
                  <Briefcase className="h-5 w-5 text-[#29b3FF]" />
                </div>
                <div>
                  <CardTitle className="text-lg text-[#0C2242] dark:text-[#D7EFFF]">General information</CardTitle>
                  <CardDescription className="text-[#999999] dark:text-[#999999]/85">
                    Legal name, industry, and a short description.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5 pt-6">
              <div className="grid gap-5 sm:grid-cols-2">
                <FieldWrapper label="Company name" required error={errors.name}>
                  <Input
                    value={form.name}
                    onChange={(e) => update("name", e.target.value)}
                    placeholder="Your company name"
                    className={cn("h-11 rounded-xl", companyInputClass)}
                  />
                </FieldWrapper>
                <FieldWrapper label="Industry">
                  <div className="relative">
                    <Briefcase className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#999999]" />
                    <Input
                      value={form.industry}
                      onChange={(e) => update("industry", e.target.value)}
                      placeholder="e.g. Technology, Manufacturing"
                      className={cn("h-11 rounded-xl pl-9", companyInputClass)}
                    />
                  </div>
                </FieldWrapper>
              </div>
              <FieldWrapper label="Description">
                <Textarea
                  value={form.description}
                  onChange={(e) => update("description", e.target.value)}
                  placeholder="Brief description of your company…"
                  rows={4}
                  className={cn("min-h-[100px] resize-none rounded-xl", companyInputClass)}
                />
                <div className="flex justify-end pt-1">
                  <span className="text-[11px] tabular-nums text-[#999999]">
                    {form.description?.length || 0}/500
                  </span>
                </div>
              </FieldWrapper>
              <FieldWrapper label="Tax ID / registration">
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#999999]" />
                  <Input
                    value={form.taxId}
                    onChange={(e) => update("taxId", e.target.value)}
                    placeholder="GST, VAT, EIN…"
                    className={cn("h-11 rounded-xl pl-9", companyInputClass)}
                  />
                </div>
              </FieldWrapper>
            </CardContent>
          </Card>

          <Card className="h-full border-[#0C2242]/10 shadow-sm dark:border-[#29b3FF]/15">
            <CardHeader className="border-b border-[#0C2242]/8 bg-[#D7EFFF]/35 pb-4 dark:border-[#29b3FF]/15 dark:bg-[#0C2242]/30">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#D7EFFF] dark:bg-[#0C2242]/90">
                  <Mail className="h-5 w-5 text-[#29b3FF]" />
                </div>
                <div>
                  <CardTitle className="text-lg text-[#0C2242] dark:text-[#D7EFFF]">Contact</CardTitle>
                  <CardDescription className="text-[#999999] dark:text-[#999999]/85">
                    Email, phone, and public website.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5 pt-6">
              <div className="grid gap-5 sm:grid-cols-2">
                <FieldWrapper label="Email" error={errors.email}>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#999999]" />
                    <Input
                      type="email"
                      value={form.email}
                      onChange={(e) => update("email", e.target.value)}
                      placeholder="company@example.com"
                      className={cn("h-11 rounded-xl pl-9", companyInputClass)}
                    />
                  </div>
                </FieldWrapper>
                <FieldWrapper label="Phone">
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#999999]" />
                    <Input
                      value={form.phone}
                      onChange={(e) => update("phone", e.target.value)}
                      placeholder="+1 (555) 123-4567"
                      className={cn("h-11 rounded-xl pl-9", companyInputClass)}
                    />
                  </div>
                </FieldWrapper>
              </div>
              <FieldWrapper label="Website" error={errors.website}>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#999999]" />
                  <Input
                    value={form.website}
                    onChange={(e) => update("website", e.target.value)}
                    placeholder="https://yourcompany.com"
                    className={cn("h-11 rounded-xl pl-9", companyInputClass)}
                  />
                </div>
              </FieldWrapper>
            </CardContent>
          </Card>

          <Card className="h-full border-[#0C2242]/10 shadow-sm dark:border-[#29b3FF]/15">
            <CardHeader className="border-b border-[#0C2242]/8 bg-[#D7EFFF]/35 pb-4 dark:border-[#29b3FF]/15 dark:bg-[#0C2242]/30">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#D7EFFF] dark:bg-[#0C2242]/90">
                  <MapPin className="h-5 w-5 text-[#29b3FF]" />
                </div>
                <div>
                  <CardTitle className="text-lg text-[#0C2242] dark:text-[#D7EFFF]">Location</CardTitle>
                  <CardDescription className="text-[#999999] dark:text-[#999999]/85">
                    Primary business address.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5 pt-6">
              <FieldWrapper label="Street address">
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#999999]" />
                  <Input
                    value={form.address}
                    onChange={(e) => update("address", e.target.value)}
                    placeholder="Street, building, suite…"
                    className={cn("h-11 rounded-xl pl-9", companyInputClass)}
                  />
                </div>
              </FieldWrapper>
              <div className="grid gap-5 sm:grid-cols-2">
                <FieldWrapper label="City">
                  <Input
                    value={form.city}
                    onChange={(e) => update("city", e.target.value)}
                    placeholder="City"
                    className={cn("h-11 rounded-xl", companyInputClass)}
                  />
                </FieldWrapper>
                <FieldWrapper label="Country">
                  <Popover open={countryOpen} onOpenChange={setCountryOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={countryOpen}
                        className={cn(
                          "h-11 w-full justify-between rounded-xl font-normal border-[#0C2242]/15 text-[#0C2242] hover:bg-[#D7EFFF]/40 dark:border-[#29b3FF]/25 dark:text-[#D7EFFF] dark:hover:bg-[#0C2242]/40",
                          companyInputClass,
                        )}
                      >
                        {form.country || "Select country"}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="flex max-h-[min(320px,70vh)] w-[var(--radix-popover-trigger-width)] flex-col overflow-hidden p-0"
                      align="start"
                      onWheel={(e) => e.stopPropagation()}
                    >
                      <Command className="flex max-h-full min-h-0 flex-col">
                        <CommandInput placeholder="Search country…" />
                        <CommandList className="min-h-0 flex-1">
                          <CommandEmpty>No country found.</CommandEmpty>
                          <CommandGroup>
                            {COUNTRIES.map((c) => (
                              <CommandItem
                                key={c}
                                value={c}
                                onSelect={() => {
                                  update("country", c);
                                  setCountryOpen(false);
                                }}
                              >
                                {c}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </FieldWrapper>
              </div>
            </CardContent>
          </Card>
        </div>

        <p className="pb-2 pt-2 text-center text-xs text-[#999999]">
          Changes apply organization-wide after you save.
        </p>
      </div>
    </div>
  );
}
