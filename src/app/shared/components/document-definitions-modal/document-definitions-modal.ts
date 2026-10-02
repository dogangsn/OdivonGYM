import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DocumentDefinitionsService } from '../../../core/services/document-definitions.service';
import {
  DocumentDefinition,
  DocumentType,
  DOCUMENT_TYPE_LABELS,
} from '../../../core/models/member-document.model';
import { AlertService } from '../../../core/services/alert.service';

@Component({
  selector: 'app-document-definitions-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, MatIconModule, MatTooltipModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './document-definitions-modal.html',
})
export class DocumentDefinitionsModal {
  private readonly fb = inject(FormBuilder);
  protected readonly defService = inject(DocumentDefinitionsService);
  private readonly alertService = inject(AlertService);

  readonly open = input<boolean>(false);
  readonly closed = output<void>();
  readonly definitionCreated = output<DocumentDefinition>();

  protected readonly showAddForm = signal<boolean>(false);
  protected readonly editingId = signal<string | null>(null);

  protected readonly docTypeLabels = DOCUMENT_TYPE_LABELS;
  protected readonly docTypes: DocumentType[] = [
    'health_report',
    'parent_consent',
    'federation_license',
    'waiver_form',
    'membership_agreement',
    'other',
  ];

  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    documentType: ['health_report' as DocumentType, [Validators.required]],
    description: [''],
    requiresExpiry: [true],
  });

  protected close(): void {
    this.showAddForm.set(false);
    this.editingId.set(null);
    this.form.reset({
      name: '',
      documentType: 'health_report',
      description: '',
      requiresExpiry: true,
    });
    this.closed.emit();
  }

  protected toggleAddForm(): void {
    this.showAddForm.update((v) => !v);
    this.editingId.set(null);
    this.form.reset({
      name: '',
      documentType: 'health_report',
      description: '',
      requiresExpiry: true,
    });
  }

  protected editDefinition(def: DocumentDefinition): void {
    this.editingId.set(def.id);
    this.showAddForm.set(true);
    this.form.patchValue({
      name: def.name,
      documentType: def.documentType,
      description: def.description || '',
      requiresExpiry: !!def.requiresExpiry,
    });
  }

  protected saveDefinition(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const val = this.form.getRawValue();
    const editing = this.editingId();

    if (editing) {
      this.defService.updateDefinition(editing, {
        name: val.name.trim(),
        documentType: val.documentType,
        description: val.description.trim(),
        requiresExpiry: val.requiresExpiry,
      });
      this.alertService.toastSuccess('Evrak tanımı güncellendi.');
      const updated = this.defService.getDefinition(editing);
      if (updated) this.definitionCreated.emit(updated);
    } else {
      const created = this.defService.addDefinition({
        name: val.name.trim(),
        documentType: val.documentType,
        description: val.description.trim(),
        requiresExpiry: val.requiresExpiry,
      });
      this.alertService.toastSuccess(`"${created.name}" zorunlu evrak tanımı eklendi.`);
      this.definitionCreated.emit(created);
    }

    this.toggleAddForm();
  }

  protected async deleteDefinition(def: DocumentDefinition): Promise<void> {
    if (def.isSystemDefault) {
      this.defService.deleteDefinition(def.id);
      this.alertService.toastSuccess(`"${def.name}" tanımı pasife alındı.`);
      return;
    }

    const confirmed = await this.alertService.deleteConfirm(
      `"${def.name}" evrak tanımını silmek istediğinize emin misiniz?`,
    );
    if (!confirmed) return;

    this.defService.deleteDefinition(def.id);
    this.alertService.toastSuccess('Evrak tanımı silindi.');
  }

  protected toggleActive(def: DocumentDefinition): void {
    this.defService.updateDefinition(def.id, { isActive: !def.isActive });
    this.alertService.toastSuccess(
      `"${def.name}" durumu ${!def.isActive ? 'aktif' : 'pasif'} olarak güncellendi.`,
    );
  }
}
