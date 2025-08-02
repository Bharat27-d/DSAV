import java.util.ArrayList;
import java.util.Scanner;

public class vehicles{
    public static void main(String[]args){
double StartTime=System.nanoTime();
        Scanner sc= new Scanner(System.in);
     
        ArrayList<String>v=new ArrayList<String>();
        v.add("car");
        v.add("Bike");
        v.add("Riksha");
        v.add("Truck");

        System.out.println("Enter type of Vehicle: "+v);
        System.out.println("Choose a Vehicle");

        String choice= sc.nextLine();
        switch (choice) {
            case "car":
                System.out.println("No of tyres: 4");
                 System.out.println("Engine CC is 1244CC");
                break;
        case "Riksha":
                System.out.println("No of tyres: 3");
                 System.out.println("Engine CC is 0CC");
                 break;
                 case "Bike":
                System.out.println("No of tyres: 2");
                 System.out.println("Engine CC is 125CC");
                break;
                case "Truck":
                System.out.println("No of tyres: 4");
                 System.out.println("Engine CC is 1000CC");
                break;
            default:
            System.out.println("Invalid");
                break;
        }
        double StopTime=System.nanoTime();
    System.out.println("Total execution Time"+(StopTime-StartTime));
    }
}
