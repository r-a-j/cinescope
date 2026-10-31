import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { AlertController } from '@ionic/angular/standalone';
import { of } from 'rxjs';
import { Router } from '@angular/router';
import { InboxPage } from './inbox.page';
import { ExtractionService } from '../../core/services/extraction.service';
import { StorageService } from '../../core/services/storage.service';
import { ToastService } from '../../core/services/toast.service';

describe('InboxPage image import', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<InboxPage>>;
  let alertController: { create: jasmine.Spy };
  let extractionService: {
    extractTitles: jasmine.Spy;
    resolveAndQueueTitles: jasmine.Spy;
  };

  beforeEach(() => {
    alertController = {
      create: jasmine.createSpy('create').and.returnValue(Promise.resolve({
        present: jasmine.createSpy('present').and.resolveTo()
      }))
    };
    extractionService = {
      extractTitles: jasmine.createSpy('extractTitles').and.returnValue(of([{ title: 'Inception', year: 2010, mediaType: 'movie' }])),
      resolveAndQueueTitles: jasmine.createSpy('resolveAndQueueTitles').and.resolveTo({ added: 1, skipped: 0, total: 1 })
    };

    TestBed.configureTestingModule({
      imports: [InboxPage],
      providers: [
        { provide: AlertController, useValue: alertController },
        { provide: ExtractionService, useValue: extractionService },
        { provide: StorageService, useValue: { inboxItems: signal([]) } },
        { provide: ToastService, useValue: {
          presentInfo: jasmine.createSpy('presentInfo').and.resolveTo(),
          presentSuccess: jasmine.createSpy('presentSuccess').and.resolveTo(),
          presentWarning: jasmine.createSpy('presentWarning').and.resolveTo(),
          presentError: jasmine.createSpy('presentError').and.resolveTo()
        } },
        { provide: Router, useValue: { navigateByUrl: jasmine.createSpy('navigateByUrl').and.resolveTo(true) } }
      ]
    });
    TestBed.overrideComponent(InboxPage, { set: { template: '', imports: [] } });
    fixture = TestBed.createComponent(InboxPage);
  });

  it('reports the submitted screenshot count after clearing the import form', async () => {
    const page = fixture.componentInstance;
    page.setImportMode('image');
    page.selectedImages.set([
      { id: 'ss1', name: 'ss1.png', base64: 'data:image/png;base64,AA==', mimeType: 'image/png', previewUrl: '', sizeText: '1 KB' },
      { id: 'ss2', name: 'ss2.png', base64: 'data:image/png;base64,AA==', mimeType: 'image/png', previewUrl: '', sizeText: '1 KB' },
      { id: 'ss3', name: 'ss3.png', base64: 'data:image/png;base64,AA==', mimeType: 'image/png', previewUrl: '', sizeText: '1 KB' }
    ]);

    await page.submitImport();

    expect(extractionService.extractTitles).toHaveBeenCalledTimes(3);
    expect(alertController.create.calls.mostRecent().args[0].message).toContain(
      'Batch analysis completed for 3 screenshots.'
    );
  });
});
