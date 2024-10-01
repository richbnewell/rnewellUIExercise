import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import {UploadService} from "../uploadservice/upload-service";
import {FormsModule, ReactiveFormsModule} from "@angular/forms";
import {DomSanitizer, SafeResourceUrl} from "@angular/platform-browser";

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    FormsModule, // required for input file change detection
    ReactiveFormsModule
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'rnewellUIExercise';
  file: File | any = null;
  fileJson: any;
  completedTrainingJson: any;
  fileUploaded:boolean = false;
  completedTrainingUrl:SafeResourceUrl = "";
  completedFYUrl:SafeResourceUrl = "";
  expiredTrainingUrl:SafeResourceUrl  = "";

  constructor(
    private uploadService: UploadService,
    private sanitizer: DomSanitizer
  ){

  }

  onFilechange(event: any) {
    console.log(event.target.files[0])
    this.file = event.target.files[0]
  }

  upload() {
    if (this.file) {
      this.uploadService.uploadfile(this.file).subscribe(resp => {
        alert("Uploaded");
        this.readDocument(this.file);
      })
    } else {
      alert("Please select a file first")
    }
  }

  readDocument(file: File) {
    let fileReader = new FileReader();
    let completedTrainingJson:any;
    let completedTrainingFYJson:any;
    let expiredTrainingJson:any;
    fileReader.onload = (e) => {
      this.fileJson = JSON.parse(fileReader.result as string);
      this.filterDuplicateTrainings(this.fileJson);
      this.fileUploaded = true;
    }
    fileReader.readAsText(this.file);
  }

  private filterDuplicateTrainings(json:any[]):void{
    // for any person who has completed the same training multiple times,
    // remove any duplicates besides the most recent
    json.forEach((entry:any)=> {

      const trainArray = entry.completions.map((c: any) => c.name);
      if (trainArray.length === entry.completions.length) {
        // no changes if no duplicate training
      } else {
        // remove any duplicate other than most recent
        let compArrayFiltered: any[] = [];
        trainArray.forEach((t:any)=> {
          const filtered = entry.completions.filter((c:any)=> c.name === t).reduce((acc:any,v:any)=> {
            return new Date(acc.timestamp).getTime() > new Date(v.timestamp).getTime()?acc:t;
          });
          compArrayFiltered.push(filtered);
        });
        entry.completions = compArrayFiltered;
      }
    })
  }

  getCompletedTraining( res: any):any{
    let arrTrain:string[] = [];
    // build list of training names
    let resFilter = res.forEach((entry: any) => {
      const compArray = entry.completions.map((c:any) => c.name);
      arrTrain.push(...compArray);
    });
    // remove duplicates of training names
    const arrTrainUnique = [...new Set(arrTrain)];

    // create json array for results
    let arrJson = arrTrainUnique.map(t=> {return {training: t, count:0};});

    arrJson.forEach((entry: any) => {
      // get count of people who have this training in their completions,
      // then increment count

      const personCount = res.filter((r:any) => {
        return r.completions.some((t:any) => {
          return t.name == entry.training;
        })
      }).length;
      entry.count = personCount;
    });

    console.log(arrJson);
    this.completedTrainingUrl = this.createDownloadLink(JSON.stringify(arrJson, null, 2));
    return arrJson;
  }

  getCompletedInFiscalYear(res: any, trainingArr:string[], fiscalYear: number):any{
    const fdStart = new Date('7/1/'+(fiscalYear-1).toString()).getTime();
    const fdEnd = new Date('7/1/'+fiscalYear.toString()).getTime();
    let resJson:any[] = [];
    trainingArr.forEach((t:string) =>{
      const names = res.filter((entry: any) => {
        return entry.completions.some((c:any) => {
          // return true if training name matches
          // and timestamp is within FY
          let isOk = false;
          if (t === c.name){
            const ts = new Date(c.timestamp).getTime();
            isOk = (ts >= fdStart) && (ts < fdEnd);
          };
          return isOk;
        })
      }).map((entry:any) => entry.name);
      resJson.push({training: t, names: names});
    })

    console.log(resJson);
    this.completedFYUrl = this.createDownloadLink(JSON.stringify(resJson, null, 2));
    return resJson;
  }

  getExpiredTraining(res: any, dateStr:string):any{
    const expDate = new Date(dateStr).getTime();
    const expSoonDate1 = new Date(dateStr);
    expSoonDate1.setMonth(expSoonDate1.getMonth() + 1);
    const expSoonDate = expSoonDate1.getTime();
    let resJson:any[] = [];

    resJson = res.filter((entry: any) => {
      return entry.completions.some((c:any) => {
        // get entries that have expiration date before or within one month of expDate
        let isOk = false;
        if (c.expires != null){
          const ed = new Date(c.expires).getTime();
          isOk = (ed <= expSoonDate);
        };
        return isOk;
      })
    }).map((entry:any) => {
      // for each filtered entry, filter the completions
      // that are expired, or expire soon
      let expArr:any[]=[];
      entry.completions.forEach((c:any)=>{
        const ed = new Date(c.expires).getTime();
        if ((c.expires != null)&&(ed <= expSoonDate)){

          let flag = "expires soon";

          if (ed <= expDate) {
            flag = "expired";
          }
          expArr.push({training:c.name, status: flag, date: new Date(ed).toLocaleDateString()});
        };
      });
      return {name: entry.name, expirations: expArr};
    });

    console.log(resJson);
    this.expiredTrainingUrl = this.createDownloadLink(JSON.stringify(resJson, null, 2));
    return resJson;
  }

  private createDownloadLink(content:string):SafeResourceUrl{
    const blob = new Blob([content], { type: 'application/octet-stream' });

    return this.sanitizer.bypassSecurityTrustResourceUrl(URL.createObjectURL(blob));
  }

}
