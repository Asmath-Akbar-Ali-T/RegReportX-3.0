import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { User } from '../models/user.model';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private readonly API_URL = 'http://localhost:9090/api/admin/users';

  constructor(private http: HttpClient) {}

  getAllUsers(): Observable<User[]> {
    return this.http.get<User[]>(this.API_URL);
  }

  createUser(user: User): Observable<any> {
    return this.http.post<any>(this.API_URL, user);
  }

  updateUser(id: number, user: User): Observable<any> {
    return this.http.put<any>(`${this.API_URL}/${id}`, user);
  }

  deleteUser(id: number): Observable<any> {
    return this.http.delete<any>(`${this.API_URL}/${id}`);
  }

  toggleUserStatus(id: number): Observable<any> {
    return this.http.patch<any>(`${this.API_URL}/${id}/status`, {});
  }
}
