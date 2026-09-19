import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth/auth.service';
import { ThemeService } from './core/services/theme.service';
import { LanguageService } from './core/i18n/language.service';
import { LoadingSpinner } from './shared/components/loading-spinner/loading-spinner';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, LoadingSpinner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly auth = inject(AuthService);

  // `providedIn: 'root'` servisleri Angular'da LAZY kurulur — sadece bir yer
  // onu `inject()` ederse yaşar. ThemeService'i sadece Shell/Sidebar
  // kullandığı için login/register gibi Shell dışı sayfalarda hiç
  // kurulmuyordu ve kullanıcının seçtiği tema (localStorage'da doğru
  // duruyor olsa bile) `<html>` sınıfına asla uygulanmıyordu — sonuç:
  // auth sayfaları her zaman OS/tarayıcı varsayılanına düşüyordu. Kök
  // component'te inject ederek uygulama açılır açılmaz, her sayfada
  // kurulmasını garantiliyoruz.
  private readonly theme = inject(ThemeService);
  // Aynı gerekçe: LanguageService de root component'te erkenden inject
  // edilmezse, henüz hiçbir Shell/auth sayfası onu kullanmadan Transloco
  // aktif dili hiç set etmemiş olur.
  private readonly language = inject(LanguageService);
}
