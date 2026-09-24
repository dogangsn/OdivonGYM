import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewChild,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-signature-pad-modal',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './signature-pad-modal.html',
  styleUrl: './signature-pad-modal.scss',
})
export class SignaturePadModal implements AfterViewInit {
  @ViewChild('signatureCanvas', { static: false })
  canvasRef!: ElementRef<HTMLCanvasElement>;

  // Inputs
  readonly open = input<boolean>(false);
  readonly memberName = input<string>('Değerli Sporcu');
  readonly contractTitle = input<string>('OdivonGYM Üyelik & KVKK Taahhütnamesi');

  // Outputs
  readonly closed = output<void>();
  readonly signatureConfirmed = output<string>();

  // State
  readonly isDrawing = signal<boolean>(false);
  readonly hasSignature = signal<boolean>(false);

  private ctx: CanvasRenderingContext2D | null = null;

  ngAfterViewInit(): void {
    this.initCanvas();
  }

  private initCanvas(): void {
    if (!this.canvasRef) return;
    const canvas = this.canvasRef.nativeElement;
    this.ctx = canvas.getContext('2d');
    if (!this.ctx) return;

    // HD Canvas scaling
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    this.ctx.scale(2, 2);

    this.ctx.strokeStyle = '#0f172a';
    this.ctx.lineWidth = 2.5;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
  }

  startDrawing(e: MouseEvent | TouchEvent): void {
    e.preventDefault();
    this.isDrawing.set(true);
    if (!this.ctx) this.initCanvas();
    if (!this.ctx) return;

    const coords = this.getCoordinates(e);
    this.ctx.beginPath();
    this.ctx.moveTo(coords.x, coords.y);
  }

  draw(e: MouseEvent | TouchEvent): void {
    if (!this.isDrawing() || !this.ctx) return;
    e.preventDefault();
    const coords = this.getCoordinates(e);
    this.ctx.lineTo(coords.x, coords.y);
    this.ctx.stroke();
    this.hasSignature.set(true);
  }

  stopDrawing(): void {
    if (!this.isDrawing()) return;
    this.isDrawing.set(false);
    this.ctx?.closePath();
  }

  clearCanvas(): void {
    if (!this.ctx || !this.canvasRef) return;
    const canvas = this.canvasRef.nativeElement;
    this.ctx.clearRect(0, 0, canvas.width, canvas.height);
    this.hasSignature.set(false);
  }

  confirmSignature(): void {
    if (!this.hasSignature() || !this.canvasRef) return;
    const dataUrl = this.canvasRef.nativeElement.toDataURL('image/png');
    this.signatureConfirmed.emit(dataUrl);
    this.closeModal();
  }

  closeModal(): void {
    this.clearCanvas();
    this.closed.emit();
  }

  private getCoordinates(e: MouseEvent | TouchEvent): { x: number; y: number } {
    const canvas = this.canvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();
    if (e instanceof MouseEvent) {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    }
    const touch = e.touches[0] || e.changedTouches[0];
    return {
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top,
    };
  }
}
